import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessageEntity } from '@core/ai/entities/chat-message.entity';
import { HookBusService } from '@/core/hookbus/services/hook.bus.service';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';

/** 单条快照条目:数据 + 落库时刻 + 原始调用 traceId(可追溯) @keyword-en hook-snapshot-entry */
export interface HookSnapshotEntry {
  data: unknown;
  ts: number;
  traceId?: string;
}

/** callWithSnapshot 返回:hook 数据 + 是否命中冻结快照 @keyword-en hook-snapshot-result */
export interface HookSnapshotResult {
  ok: boolean;
  data?: unknown;
  errorMsg?: string;
  /** true=返回的是冻结快照;false=本次实时拉取(可能已写入快照) @keyword-en snapshot-cached-flag */
  cached: boolean;
}

interface CallWithSnapshotArgs {
  messageId?: string;
  hookName: string;
  payload?: unknown;
  /** true 则每次实时拉、不读不写快照 @keyword-en snapshot-live-bypass */
  live?: boolean;
  context: {
    token?: string;
    principalId?: string;
    principalType?: string;
  };
}

/** 单条快照超过此字节数则拒绝缓存(回退实时),避免 message.metadata 膨胀 @keyword-en snapshot-size-limit */
const MAX_SNAPSHOT_BYTES = 8000;

/**
 * @title Hook 快照服务
 * @description conversation 侧的 Web Component Hook 调用入口,在 message.metadata.hookSnapshots 上做
 *              "写一次" cache-aside:首个请求到 (messageId, hookName, payload) 即冻结,后续命中返回冻结快照,
 *              下次不再经 HookBus 取数。live / 无 messageId / 超阈值 → 不缓存,实时经 HookBus 路由。
 *              hookbus 保持纯路由,快照归对话所有(设计见 hook-component-runtime.design.md §3/§6/§8)。
 * @keywords-cn hook快照, 写一次缓存, cache-aside, 可追溯, 消息锚定
 * @keywords-en hook-snapshot, write-once-cache, cache-aside, traceability, message-anchored
 */
@Injectable()
export class HookSnapshotService {
  private readonly logger = new Logger(HookSnapshotService.name);

  constructor(
    @InjectRepository(ChatMessageEntity)
    private readonly messageRepo: Repository<ChatMessageEntity>,
    private readonly hookBus: HookBusService,
  ) {}

  /**
   * 按 hook 名调用,带消息锚定的写一次快照缓存。
   * @keyword-en call-with-snapshot
   */
  async callWithSnapshot(
    args: CallWithSnapshotArgs,
  ): Promise<HookSnapshotResult> {
    const { messageId, hookName, payload, live, context } = args;
    const key = this.snapshotKey(hookName, payload);

    // 命中冻结快照:不经 HookBus 直接返回
    if (!live && messageId) {
      const cached = await this.readSnapshot(messageId, key);
      if (cached) {
        this.logger.debug(`[hook-snapshot] hit key=${key} msg=${messageId}`);
        return { ok: true, data: cached.data, cached: true };
      }
    }

    // 未命中(或 live / 无 messageId)→ 实时经 HookBus 路由
    const emitted = await this.emitHook(hookName, payload, context);
    if (!emitted.ok)
      return { ok: false, errorMsg: emitted.errorMsg, cached: false };

    // 写一次:仅在可缓存(非 live、有 messageId、未超阈值)时落库
    if (!live && messageId && this.withinSizeLimit(emitted.data)) {
      await this.writeSnapshotOnce(messageId, key, {
        data: emitted.data,
        ts: Date.now(),
        traceId: undefined,
      });
    }
    return { ok: true, data: emitted.data, cached: false };
  }

  /**
   * 经 HookBus 调用 hook,payload 规范化为位置参数数组(与 /hook-invoke 一致)。
   * @keyword-en emit-hook-via-bus
   */
  private async emitHook(
    hookName: string,
    payload: unknown,
    context: CallWithSnapshotArgs['context'],
  ): Promise<{ ok: boolean; data?: unknown; errorMsg?: string }> {
    let normalized: unknown;
    if (payload === undefined || payload === null) {
      normalized = [{}];
    } else if (Array.isArray(payload)) {
      normalized = payload.length > 0 ? payload : [{}];
    } else {
      normalized = [payload];
    }

    const results = await this.hookBus.emit({
      name: hookName,
      payload: normalized,
      context: {
        source: 'http',
        token: context.token,
        principalId: context.principalId,
        principalType: context.principalType,
      },
    });
    if (!results.length) {
      return {
        ok: false,
        errorMsg: `no handler registered for hook: ${hookName}`,
      };
    }
    const first = results[0];
    if (first.status === HookResultStatus.Error) {
      return { ok: false, errorMsg: first.error ?? 'hook error' };
    }
    return { ok: true, data: first.data };
  }

  /**
   * 读取消息上指定 key 的冻结快照。
   * @keyword-en read-snapshot
   */
  private async readSnapshot(
    messageId: string,
    key: string,
  ): Promise<HookSnapshotEntry | null> {
    const msg = await this.messageRepo.findOne({
      where: { id: messageId, isDelete: false },
      select: { id: true, metadata: true },
    });
    const snaps = msg?.metadata?.hookSnapshots as
      | Record<string, HookSnapshotEntry>
      | undefined;
    return snaps?.[key] ?? null;
  }

  /**
   * 写一次:同 key 已存在则不覆盖(写前再读一次降低并发双写)。改写须经显式 refresh。
   * @keyword-en write-snapshot-once
   */
  private async writeSnapshotOnce(
    messageId: string,
    key: string,
    entry: HookSnapshotEntry,
  ): Promise<void> {
    const msg = await this.messageRepo.findOne({
      where: { id: messageId, isDelete: false },
      select: { id: true, metadata: true },
    });
    if (!msg) return; // 消息不存在(如未落库的临时消息)→ 不缓存
    const metadata = msg.metadata ?? {};
    const snaps = (metadata.hookSnapshots ?? {}) as Record<
      string,
      HookSnapshotEntry
    >;
    if (snaps[key]) return; // 写一次:已存在不覆盖
    snaps[key] = entry;
    metadata.hookSnapshots = snaps;
    await this.messageRepo.update(messageId, { metadata });
  }

  /**
   * 快照 key = `${hookName}#${hash(canonical(payload))}`;canonical 排序键以稳定哈希。
   * @keyword-en snapshot-key, canonical-payload
   */
  private snapshotKey(hookName: string, payload: unknown): string {
    const keyPayload = payload == null ? {} : payload;
    return `${hookName}#${fnv1a(stableStringify(keyPayload))}`;
  }

  /** 序列化后字节是否在缓存上限内 @keyword-en within-size-limit */
  private withinSizeLimit(data: unknown): boolean {
    try {
      return JSON.stringify(data ?? null).length <= MAX_SNAPSHOT_BYTES;
    } catch {
      return false;
    }
  }
}

/**
 * 稳定序列化:对象键排序,保证 {a,b} 与 {b,a} 得到同一字符串。
 * @keyword-en stable-stringify
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/**
 * FNV-1a 32 位哈希,base36 输出,用于把规范化 payload 压成短 key。
 * @keyword-en fnv1a-hash
 */
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
