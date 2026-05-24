import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { uuidv7 } from 'uuidv7';
import {
  ChatSessionDataEntity,
  SessionDataType,
} from '@core/ai/entities/chat-session-data.entity';

/**
 * 允许的 key 字符 :: 字母数字 + 下划线 + 短横 + **点号** (用于分层命名 directive.confirm-before-delete / handbook.proactive);
 * key 的第一段就是 derived category (handbook / directive / preference / recipe / legacy categories / general).
 * @keyword-en session-data-key-regex layered-key
 */
const KEY_RE = /^[a-zA-Z0-9_.-]{1,128}$/;
const MAX_KEYS = 50;
const MAX_VALUE_BYTES = 10_000;
const MAX_TOTAL_BYTES = 200_000;

/**
 * 已知 category 集合 :: session_data 只承担会话约束/偏好、系统手册和少量显式配方;
 *  - handbook :: **必读手册** (按 createdUser === 当前 principalId 过滤, 群聊多 agent 隔离)
 *  - directive / preference :: 会话级约束与偏好, 可被调用方注入到每轮上下文
 *  - recipe :: 显式保存的多步任务配方
 *  - knowledge / hook / entity :: 旧分类兼容; 新链路不再自动沉淀
 *  - 其他不在白名单的前缀 → general
 * @keyword-en derive-category known-categories
 */
const KNOWN_CATEGORIES = new Set([
  'handbook',
  'directive',
  'preference',
  'knowledge',
  'recipe',
  'hook',
  'entity',
]);

/**
 * 从 dataKey 第一段派生 category, 不在已知集合 → general
 * @keyword-en derive-category-from-key
 */
export function deriveCategory(key: string): string {
  const seg = key.split('.')[0];
  return KNOWN_CATEGORIES.has(seg) ? seg : 'general';
}

/** list 返回的单条元数据 (供 hook handler 渲染) */
export interface SessionDataListItem {
  key: string;
  title: string | null;
  updatedAt: Date;
  sizeBytes: number;
  category: string;
  /** 该条的所有者 principal (handbook 过滤用; 其他 category 也透出便于调试) */
  ownerPrincipalId: string | null;
}

/**
 * @title AI 会话数据服务
 * @description 管理 AI 自主读写的对话级 session_data，支持 key-value 存储与 category 分组查询。
 *              category 从 key 第一段派生 (handbook/directive/preference/recipe/legacy/general);
 *              handbook 类按 createdUser 严格过滤, 群聊多 agent 互不可见对方手册。
 * @keywords-cn AI会话数据, session-data, key-value, 分类, 必读, 所有者过滤
 * @keywords-en ai-session-data, key-value, category, must-read, owner-filter
 */
@Injectable()
export class AiSessionDataService {
  private readonly logger = new Logger(AiSessionDataService.name);

  constructor(
    @InjectRepository(ChatSessionDataEntity)
    private readonly dataRepo: Repository<ChatSessionDataEntity>,
  ) {}

  /**
   * upsert 一个 key-value 记录, 同时记录 owner principal (落 createdUser)
   *  - LLM 调用路径 :: hook handler 从 event.context.principalId 取并传入
   *  - 系统 seed 路径 :: 显式传 agent 的 principalId (确保 handbook 归属正确)
   * @keyword-en save-upsert with-owner
   */
  async save(
    sessionId: string,
    key: string,
    value: unknown,
    title?: string,
    ownerPrincipalId?: string,
  ): Promise<void> {
    if (!KEY_RE.test(key)) {
      throw new Error(
        `invalid key "${key}": must match ^[a-zA-Z0-9_.-]{1,128}$`,
      );
    }
    if (title !== undefined && title.length > 255) {
      throw new Error(`title too long: ${title.length} > 255`);
    }

    const valStr = JSON.stringify(value);
    if (valStr.length > MAX_VALUE_BYTES) {
      throw new Error(`value too large: ${valStr.length} > ${MAX_VALUE_BYTES}`);
    }

    const existing = await this.dataRepo.find({
      where: {
        forSessionId: sessionId,
        dataType: SessionDataType.AiSession,
        dataKey: key,
        isDelete: false,
      },
    });

    const totalBytes =
      existing.reduce((sum, r) => sum + (r.dataVal?.length ?? 0), 0) +
      valStr.length -
      (existing[0]?.dataVal?.length ?? 0);

    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error(`total session data exceeds ${MAX_TOTAL_BYTES} bytes`);
    }

    const activeCount = await this.dataRepo.count({
      where: {
        forSessionId: sessionId,
        dataType: SessionDataType.AiSession,
        isDelete: false,
      },
    });

    if (existing.length === 0 && activeCount >= MAX_KEYS) {
      throw new Error(`too many keys: ${activeCount} >= ${MAX_KEYS}`);
    }

    if (existing.length > 0) {
      await this.dataRepo.update({ id: existing[0].id }, { isDelete: true });
    }

    const entity = this.dataRepo.create({
      id: uuidv7(),
      dataType: SessionDataType.AiSession,
      dataVal: valStr,
      forSessionId: sessionId,
      dataKey: key,
      dataTitle: title ?? undefined,
      // ownerPrincipalId 落 createdUser, 用于 list handbook 过滤
      createdUser: ownerPrincipalId ?? '',
    });
    await this.dataRepo.save(entity);
    this.logger.debug(
      `[ai-session-data] saved key="${key}" session=${sessionId} owner=${ownerPrincipalId ?? '∅'}`,
    );
  }

  /**
   * 获取单个 key 的值 (跨 owner 可见, get 只看 sessionId + key)
   * @keyword-en get-key
   */
  async get(
    sessionId: string,
    key: string,
  ): Promise<{
    key: string;
    title: string | null;
    value: unknown;
    updatedAt: Date;
    category: string;
    ownerPrincipalId: string | null;
  } | null> {
    const row = await this.dataRepo.findOne({
      where: {
        forSessionId: sessionId,
        dataType: SessionDataType.AiSession,
        dataKey: key,
        isDelete: false,
      },
    });
    if (!row) return null;
    try {
      return {
        key: row.dataKey!,
        title: row.dataTitle ?? null,
        value: JSON.parse(row.dataVal),
        updatedAt: row.updatedAt,
        category: deriveCategory(row.dataKey!),
        ownerPrincipalId: row.createdUser || null,
      };
    } catch {
      return null;
    }
  }

  /**
   * 列出本会话全部 session_data 的轻量元数据 (按 category 派生分组)
   *  - opts.handbookOwnerPrincipalId 传入时, handbook 类只保留 createdUser === 该值
   *  - 其他 category (knowledge/recipe/hook/entity/general) 不过滤, session-wide 共享
   *  - 不返 value, list 输出体积稳定; LLM 凭 title + category 命中后调 get 取详情
   * @keyword-en list-keys grouped-by-category handbook-owner-filter
   */
  async list(
    sessionId: string,
    opts?: { handbookOwnerPrincipalId?: string },
  ): Promise<SessionDataListItem[]> {
    const rows = await this.dataRepo.find({
      where: {
        forSessionId: sessionId,
        dataType: SessionDataType.AiSession,
        isDelete: false,
      },
      order: { updatedAt: 'DESC' },
    });

    const filter = opts?.handbookOwnerPrincipalId;
    const items = rows.map<SessionDataListItem>((r) => ({
      key: r.dataKey!,
      title: r.dataTitle ?? null,
      updatedAt: r.updatedAt,
      sizeBytes: r.dataVal?.length ?? 0,
      category: deriveCategory(r.dataKey!),
      ownerPrincipalId: r.createdUser || null,
    }));

    if (!filter) return items;
    // handbook 类按 owner 严格过滤; 其他 category 全保留
    return items.filter(
      (it) => it.category !== 'handbook' || it.ownerPrincipalId === filter,
    );
  }

  /**
   * 软删除单个 key
   * @keyword-en delete-key
   */
  async delete(sessionId: string, key: string): Promise<boolean> {
    const result = await this.dataRepo.update(
      {
        forSessionId: sessionId,
        dataType: SessionDataType.AiSession,
        dataKey: key,
        isDelete: false,
      },
      { isDelete: true },
    );
    return (result.affected ?? 0) > 0;
  }
}
