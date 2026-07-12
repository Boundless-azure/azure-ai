import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Brackets } from 'typeorm';
import { uuidv7 } from 'uuidv7';
import {
  ChatSessionDataEntity,
  SessionDataType,
} from '@core/ai/entities/chat-session-data.entity';

/**
 * call_hook 调用日志的硬上限 :: 每个 session 最多保留 50 条**成功**记录, 超出 FIFO 软删旧条目.
 * 失败项不记录 (errorMsg.length > 0 由 caller 自己 short-circuit, service 层假设入参都是成功项).
 * @keyword-en max-call-log-per-session
 */
const MAX_LOG_PER_SESSION = 50;

/** payload 摘要的字段数上限 (title 生成时取前 N 个非空字段) */
const PAYLOAD_SUMMARY_FIELDS = 3;
/** 单字段值预览长度 (title 生成用, 控制 title 不过长) */
const PAYLOAD_SUMMARY_VALUE_MAX = 32;

/** call log 持久化形态 :: dataVal 反序列化结果 */
export interface CallLogRecord {
  hookName: string;
  target: 'saas' | 'runner';
  runnerId?: string;
  payload: unknown;
  result: unknown;
  ts: number;
}

/** query 返回的轻量条目 */
export interface CallLogQueryItem {
  id: string;
  hookName: string;
  target: 'saas' | 'runner';
  runnerId: string | null;
  title: string;
  ts: number;
  payload?: unknown;
  result?: unknown;
}

/**
 * @title AI call_hook 调用日志服务
 * @description 硬记录主对话 LLM 每一次成功的 call_hook (一条 entry 一行), FIFO 50 条上限, 不进
 *              enrichWithSessionRecall 注入, 仅 LLM 主动 callHistory.query 才能查询. 用于:
 *               - "上次查过的 X" 类引用 (避免重复 hook 调用)
 *               - 调试 / 历史回溯
 *              失败 (errorMsg.length>0) 项不记录 — 失败只服务当前轮纠错, 跨轮只保留成功事实日志.
 * @keywords-cn 调用日志, 硬记录, FIFO, 50条上限, 仅成功项, 查询历史
 * @keywords-en call-log, hard-record, fifo, only-success, query-history
 */
@Injectable()
export class AiCallLogService {
  private readonly logger = new Logger(AiCallLogService.name);

  constructor(
    @InjectRepository(ChatSessionDataEntity)
    private readonly dataRepo: Repository<ChatSessionDataEntity>,
  ) {}

  /**
   * 追加一条 call log; 写完顺手 FIFO 驱逐, 保证总条数 ≤ MAX_LOG_PER_SESSION.
   *  - caller 保证 record 为成功项 (errorMsg 已校验空); service 不再校验.
   *  - call log 是事实流水, 不按 payload/result 大小跳过.
   * @keyword-en append-call-log fifo-evict
   */
  async append(
    sessionId: string,
    record: CallLogRecord,
    ownerPrincipalId?: string,
  ): Promise<void> {
    if (!sessionId) return;
    const valStr = JSON.stringify(record);
    const title = buildLogTitle(record);

    const entity = this.dataRepo.create({
      id: uuidv7(),
      dataType: SessionDataType.AiCallLog,
      dataVal: valStr,
      forSessionId: sessionId,
      dataKey: uuidv7(), // call log 无业务 key, 用 uuid 防冲突 (dataKey 仍参与索引 + list 查询)
      dataTitle: title,
      createdUser: ownerPrincipalId ?? '',
    });
    await this.dataRepo.save(entity);

    // FIFO 驱逐 :: 超过上限的旧记录软删
    await this.evictOld(sessionId);
  }

  /**
   * FIFO 驱逐 :: 按 createdAt ASC 取所有 active 条目, 超过 MAX 的前 N 条软删
   *  - 不依赖 LIMIT/OFFSET (TypeORM update 不支持 limit), 改用 id 列表 IN 删
   * @keyword-en evict-old-fifo
   */
  private async evictOld(sessionId: string): Promise<void> {
    const all = await this.dataRepo.find({
      where: {
        forSessionId: sessionId,
        dataType: SessionDataType.AiCallLog,
        isDelete: false,
      },
      order: { createdAt: 'ASC' },
      select: ['id'],
    });
    if (all.length <= MAX_LOG_PER_SESSION) return;
    const toEvictIds = all
      .slice(0, all.length - MAX_LOG_PER_SESSION)
      .map((r) => r.id);
    await this.dataRepo.update({ id: In(toEvictIds) }, { isDelete: true });
    this.logger.debug(
      `[call-log] evicted ${toEvictIds.length} old records session=${sessionId}`,
    );
  }

  /**
   * 按统一 search 字段 / 时间倒序 查询调用日志
   *  - 默认不限制 limit, 返回当前保留的最多 50 条轻量 title 列表
   *  - includeDetail=false 时不返回 payload/result, 避免默认回包过大
   *  - id 精确命中用于第二段取详情; search 在 title / dataVal 内 LIKE
   * @keyword-en query-call-log
   */
  async query(
    sessionId: string,
    opts: {
      id?: string;
      search?: string;
      limit?: number;
      includeDetail?: boolean;
    },
  ): Promise<CallLogQueryItem[]> {
    const limit = Math.max(
      1,
      Math.min(opts.limit ?? MAX_LOG_PER_SESSION, MAX_LOG_PER_SESSION),
    );
    const qb = this.dataRepo
      .createQueryBuilder('d')
      .where('d.for_session_id = :sid', { sid: sessionId })
      .andWhere('d.data_type = :type', { type: SessionDataType.AiCallLog })
      .andWhere('d.is_delete = false');

    if (opts.id?.trim()) {
      qb.andWhere('d.id = :id', { id: opts.id.trim() });
    }

    if (opts.search && opts.search.trim()) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('d.data_title LIKE :search')
            .orWhere('d.data_val LIKE :search');
        }),
        { search: `%${opts.search.trim()}%` },
      );
    }

    const rows = await qb
      .orderBy('d.created_at', 'DESC')
      .limit(limit)
      .getMany();

    return rows
      .map((r) => parseRow(r, opts.includeDetail === true))
      .filter((x): x is CallLogQueryItem => x !== null);
  }

  /**
   * 清除指定 session 的全部 call log (会话结束时可调; 当前未接入清理时机)
   * @keyword-en clear-session-call-log
   */
  async clearSession(sessionId: string): Promise<void> {
    await this.dataRepo.update(
      {
        forSessionId: sessionId,
        dataType: SessionDataType.AiCallLog,
        isDelete: false,
      },
      { isDelete: true },
    );
  }
}

/**
 * 用完整 hookName + payload 前几个字段生成命中性 title
 *  - 形态 :: `<hookName原文> :: k1=v1, k2=v2`
 *  - callHistory.search 会查 dataTitle, 所以 title 必须保留完整 hookName, 不能缩写
 *  - 字段值预览截断 PAYLOAD_SUMMARY_VALUE_MAX 字符, 防 title 超 255
 * @keyword-en build-call-log-title
 */
function buildLogTitle(record: CallLogRecord): string {
  const hookName = record.hookName;
  const payload = normalizePayloadForTitle(record.payload);
  if (!payload || typeof payload !== 'object') {
    return `${hookName} :: ${record.target}`.slice(0, 255);
  }
  const entries = Object.entries(payload as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .slice(0, PAYLOAD_SUMMARY_FIELDS)
    .map(([k, v]) => {
      let vs: string;
      try {
        vs = typeof v === 'string' ? v : JSON.stringify(v);
      } catch {
        vs = String(v);
      }
      if (vs.length > PAYLOAD_SUMMARY_VALUE_MAX) {
        vs = vs.slice(0, PAYLOAD_SUMMARY_VALUE_MAX) + '…';
      }
      return `${k}=${vs}`;
    });
  const summary = entries.length > 0 ? entries.join(', ') : '(no payload)';
  return `${hookName} :: ${summary}`.slice(0, 255);
}

/**
 * call_hook payload 现在是单对象; 直接用于 title 摘要 (兼容旧式单元素数组 → 取第 0 个).
 * @keyword-en normalize-payload-for-title
 */
function normalizePayloadForTitle(payload: unknown): unknown {
  if (Array.isArray(payload) && payload.length === 1) return payload[0];
  return payload;
}

/**
 * 反序列化一行 → CallLogQueryItem; 默认只返回 title 元数据, 详情按需返回
 * @keyword-en parse-call-log-row
 */
function parseRow(
  row: ChatSessionDataEntity,
  includeDetail: boolean,
): CallLogQueryItem | null {
  try {
    const parsed = JSON.parse(row.dataVal) as CallLogRecord;
    const item: CallLogQueryItem = {
      id: row.id,
      hookName: parsed.hookName,
      target: parsed.target,
      runnerId: parsed.runnerId ?? null,
      title: row.dataTitle ?? '',
      ts: parsed.ts,
    };
    if (includeDetail) {
      item.payload = parsed.payload;
      item.result = parsed.result;
    }
    return item;
  } catch {
    return null;
  }
}
