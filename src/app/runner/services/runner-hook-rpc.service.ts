import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Socket } from 'socket.io';
import {
  HOOK_CALL_ACK_TIMEOUT_MS,
  HOOK_CALL_INFLIGHT_LIMIT,
  HOOK_CALL_STALE_TIMEOUT_MS,
  HOOK_CALL_TICK_INTERVAL_MS,
  RunnerWsEvent,
} from '../enums/runner.enums';
import type {
  HookCallEnvelope,
  HookCallProgress,
  HookCallReply,
  HookInvocationContextWire,
} from '../types/runner.types';
import { AbilityService } from '@/app/identity/services/ability.service';
import { PermissionDefinitionType } from '@/app/identity/enums/permission.enums';

/**
 * @title Runner Hook RPC 服务
 * @description SaaS 侧调度 Runner Hook 的 in-flight 状态机。
 *              不入库, 仅内存维护 callId -> {resolve, deadline}, 由统一 1s tick 扫表判超时。
 *              ack 3s 未到 → runner 离线软错; ack 后任一进度信号 5s 内未到 → 僵死软错。
 *              背压: 每个 runnerId 同时 in-flight 上限 64, 超出立即软返回。
 * @keywords-cn Hook RPC, 调度, 在途队列, 软超时, 背压
 * @keywords-en hook-rpc, dispatcher, inflight-queue, soft-timeout, backpressure
 */
type SocketResolver = (runnerId: string) => Socket | undefined;

/**
 * SaaS push 给 runner 的身份载荷, 与 runner/src/modules/identity/types/identity.types.ts 的 RunnerIdentityContext 同形。
 * 类型在此重复声明避免 saas → runner 反向依赖。
 * @keyword-en runner-identity-push-block, contract-mirror
 */
interface RunnerIdentityPushBlock {
  principalId: string;
  tenantId?: string;
  abilityRules?: Array<{ action: string; subject: string }>;
  dataPermissions?: Array<{
    table: string;
    nodeKey: string;
    action?: string;
    where?: Record<string, unknown>;
  }>;
}

@Injectable()
export class RunnerHookRpcService implements OnModuleDestroy {
  private readonly logger = new Logger(RunnerHookRpcService.name);
  private readonly inflight = new Map<string, InflightEntry>();
  private readonly perRunnerCount = new Map<string, number>();
  private readonly tick: NodeJS.Timeout;
  private resolver: SocketResolver = () => undefined;

  constructor(private readonly ability: AbilityService) {
    this.tick = setInterval(
      () => this.scan(),
      HOOK_CALL_TICK_INTERVAL_MS,
    ).unref();
  }

  /**
   * 30s in-memory 缓存: principalId → identity 上下文 (abilityRules + dataPermissions)。
   * 减少 LLM 高频调 runner hook 时的 DB 查询压力; TTL 短足以让权限变更快速生效。
   * @keyword-en identity-push-cache, principal-ttl-cache
   */
  private readonly identityCache = new Map<
    string,
    { value: RunnerIdentityPushBlock; expiresAt: number }
  >();
  private readonly IDENTITY_CACHE_TTL_MS = 30_000;

  /**
   * 拉取 principal 的 ability rules + data permissions, 序列化成 push 给 runner 的 identity 块。
   * 失败时返回最小载荷 (仅 principalId), 不阻塞主调用 — runner middleware 会因 abilityRules 缺失而拒绝 LLM 调用。
   * @keyword-en build-runner-identity-push
   */
  private async buildIdentityPush(
    principalId: string,
    tenantId?: string,
  ): Promise<RunnerIdentityPushBlock> {
    const cacheKey = `${principalId}::${tenantId ?? ''}`;
    const cached = this.identityCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    try {
      const ability = await this.ability.buildForPrincipal(principalId);
      const dataPerms = await this.ability.listPermissionsByType(
        principalId,
        PermissionDefinitionType.Data,
      );
      const value: RunnerIdentityPushBlock = {
        principalId,
        ...(tenantId ? { tenantId } : {}),
        abilityRules: ability.rules,
        dataPermissions: dataPerms.map((p) => ({
          table: p.subject,
          nodeKey: `${p.subject}:${p.action}`,
          action: p.action,
        })),
      };
      this.identityCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + this.IDENTITY_CACHE_TTL_MS,
      });
      return value;
    } catch (e) {
      this.logger.warn(
        `[runner-identity-push] failed for principal=${principalId}: ${e instanceof Error ? e.message : String(e)}`,
      );
      return { principalId, ...(tenantId ? { tenantId } : {}) };
    }
  }

  /**
   * @title 注入 socket 解析器
   * @description Gateway 启动后把 runnerId→Socket 解析函数交给 RPC 服务, 避免双向依赖。
   * @keyword-en set-socket-resolver
   */
  setSocketResolver(resolver: SocketResolver): void {
    this.resolver = resolver;
  }

  onModuleDestroy(): void {
    clearInterval(this.tick);
    for (const entry of this.inflight.values()) {
      entry.resolve(softError('saas-shutdown'));
    }
    this.inflight.clear();
    this.perRunnerCount.clear();
  }

  /**
   * @title 派发一个 hook 调用
   * @description 注册 in-flight, 通过 socket 发出 hook:call, 等待 Runner 回 ack/result。
   *              不抛异常, 任何异常路径均以 HookCallReply.errorMsg 软返回, 给 LLM 纠错。
   * @keyword-en dispatch-hook
   */
  async callHook(
    runnerId: string,
    body: {
      hookName: string;
      payload?: unknown;
      context?: HookInvocationContextWire;
      debug?: boolean;
      debugDb?: boolean;
    },
  ): Promise<HookCallReply> {
    const socket = this.resolver(runnerId);
    // @ts-expect-error - 检查 Socket 连接状态
    if (!socket || !socket.connected) {
      return softError('runner-offline');
    }
    const used = this.perRunnerCount.get(runnerId) ?? 0;
    if (used >= HOOK_CALL_INFLIGHT_LIMIT) {
      return softError('runner-busy');
    }
    const callId = `${runnerId}.${randomUUID().replace(/-/g, '').slice(0, 12)}`;

    // LLM 链路: push identity (abilityRules + dataPermissions) 到 extras.identitySaasHint, 给 runner ability middleware 作为 **hint** 使用。
    // - Runner 端有自己的本地 RBAC, 优先查本地; 仅当本地无该 principal 记录时, hint 作为 fallback
    // - 非 LLM 来源 (system/runner 内部) 跳过, 避免不必要的 DB 查询
    let enrichedExtras = body.context?.extras;
    const isLlm = body.context?.source === 'llm';
    const principalId = body.context?.principalId;
    if (isLlm && principalId) {
      const tid = (body.context?.extras as { tenantId?: string } | undefined)
        ?.tenantId;
      const identityHint = await this.buildIdentityPush(principalId, tid);
      enrichedExtras = {
        ...(enrichedExtras ?? {}),
        identitySaasHint: identityHint,
      };
    }

    const envelope: HookCallEnvelope = {
      callId,
      hookName: body.hookName,
      payload: body.payload,
      context: body.context
        ? {
            ...body.context,
            ...(enrichedExtras ? { extras: enrichedExtras } : {}),
            runnerId,
          }
        : { runnerId },
      debug: body.debug,
      debugDb: body.debugDb,
    };
    return await new Promise<HookCallReply>((resolve) => {
      const now = Date.now();
      this.inflight.set(callId, {
        runnerId,
        resolve,
        ackBy: now + HOOK_CALL_ACK_TIMEOUT_MS,
        staleBy: null,
      });
      this.perRunnerCount.set(runnerId, used + 1);
      socket.emit(RunnerWsEvent.HookCall, envelope);
    });
  }

  /**
   * @title 处理 Runner 回 ack
   * @description 收到 ack 后清除 ack 截止, 改为 stale 截止 (5s 内必须有 progress 或 result)。
   * @keyword-en handle-ack
   */
  handleAck(callId: string): void {
    const entry = this.inflight.get(callId);
    if (!entry) return;
    entry.ackBy = null;
    entry.staleBy = Date.now() + HOOK_CALL_STALE_TIMEOUT_MS;
  }

  /**
   * @title 处理 Runner 进度心跳
   * @description Runner 每 3s 合并推送 in-flight callIds, 命中即续命 stale 截止。
   * @keyword-en handle-progress
   */
  handleProgress(progress: HookCallProgress): void {
    const next = Date.now() + HOOK_CALL_STALE_TIMEOUT_MS;
    for (const callId of progress.callIds) {
      const entry = this.inflight.get(callId);
      if (!entry) continue;
      entry.staleBy = next;
    }
  }

  /**
   * @title 处理 Runner 终态回包
   * @description 完成 in-flight, 解锁背压计数。
   * @keyword-en handle-result
   */
  handleResult(callId: string, reply: HookCallReply): void {
    const entry = this.inflight.get(callId);
    if (!entry) return;
    this.complete(callId, entry, reply);
  }

  /**
   * @title runner 断连清扫
   * @description 该 runner 名下所有 in-flight 立即软返回 runner-offline。
   * @keyword-en cleanup-runner
   */
  cleanupRunner(runnerId: string): void {
    for (const [callId, entry] of this.inflight) {
      if (entry.runnerId !== runnerId) continue;
      this.complete(callId, entry, softError('runner-offline'));
    }
    this.perRunnerCount.delete(runnerId);
  }

  private scan(): void {
    const now = Date.now();
    for (const [callId, entry] of this.inflight) {
      if (entry.ackBy !== null && now >= entry.ackBy) {
        this.complete(callId, entry, softError('runner-offline'));
        continue;
      }
      if (entry.staleBy !== null && now >= entry.staleBy) {
        this.complete(callId, entry, softError('runner-stale'));
      }
    }
  }

  private complete(
    callId: string,
    entry: InflightEntry,
    reply: HookCallReply,
  ): void {
    this.inflight.delete(callId);
    const used = this.perRunnerCount.get(entry.runnerId) ?? 0;
    if (used <= 1) {
      this.perRunnerCount.delete(entry.runnerId);
    } else {
      this.perRunnerCount.set(entry.runnerId, used - 1);
    }
    try {
      entry.resolve(reply);
    } catch (e) {
      this.logger.warn(
        `resolve callId=${callId} threw: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}

interface InflightEntry {
  runnerId: string;
  resolve: (reply: HookCallReply) => void;
  /** ack 截止 (ms epoch); null 表示已收到 ack */
  ackBy: number | null;
  /** stale 截止 (ms epoch); null 表示尚未进入 stale 监控阶段 */
  staleBy: number | null;
}

function softError(code: string): HookCallReply {
  return { errorMsg: [code], result: null, debugLog: [] };
}
