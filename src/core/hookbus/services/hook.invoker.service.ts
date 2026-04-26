import { Injectable, Logger } from '@nestjs/common';
import { HookResultStatus } from '../enums/hook.enums';
import type {
  HookEvent,
  HookRegistration,
  HookMiddleware,
  HookResult,
} from '../types/hook.types';
import { HookCacheService } from '../cache/hook.cache';
import { createHookLogSession } from '@core/observability/services/hook-log.factory';

/**
 * @title Hook 调用器服务
 * @description 串接全局中间件 + 声明级中间件 + 命中的 handler。
 *              统一签名 (event, next) => HookResult, 无 ctx wrapper。
 * @keywords-cn Hook调用, 中间件链, 状态缓存
 * @keywords-en hook-invoker, middleware-chain, status-cache
 */
@Injectable()
export class HookInvokerService {
  private readonly logger = new Logger(HookInvokerService.name);
  private middlewares: HookMiddleware[] = [];
  private namedMiddlewares = new Map<string, HookMiddleware>();

  constructor(private readonly cache: HookCacheService) {}

  use(mw: HookMiddleware): void {
    this.middlewares.push(mw);
  }

  useNamed(name: string, mw: HookMiddleware): void {
    this.namedMiddlewares.set(name, mw);
  }

  /**
   * 调用一个 event 的所有命中 registration, 并发执行 + 状态缓存
   * @keyword-en invoke-hook
   */
  async invoke<T, R>(
    event: HookEvent<T>,
    regs: HookRegistration<T, R>[],
  ): Promise<HookResult<R>[]> {
    if (!regs.length) {
      await this.safeRecordStatus(event.name, HookResultStatus.Skipped);
      return [{ status: HookResultStatus.Skipped }];
    }

    // event.context.extras.debug=true 触发 OTel sandbox tracer (单次调用范围内, 多个命中 reg 各持独立会话)
    const debug = Boolean(event.context?.extras?.debug);
    const upstreamTraceId = event.context?.traceId;

    const tasks = regs.map(async (reg) => {
      const start = Date.now();
      const session = createHookLogSession({
        hookName: event.name,
        debug,
        upstreamTraceId,
      });
      const eventMws = (event.declaration?.middlewares ?? [])
        .map((name) => this.namedMiddlewares.get(name))
        .filter((item): item is HookMiddleware<T, R> => Boolean(item));
      const chain = this.compose<T, R>(
        [...eventMws, ...this.middlewares] as HookMiddleware<T, R>[],
        async (ev) => this.runHandlerWithSchema(reg, ev),
      );
      // metadata.requiredAbility 镜像到 event.declaration 给中间件读 (不污染原 event)
      const decorated: HookEvent<T> = {
        ...event,
        log: session.log,
        ...(reg.metadata?.requiredAbility
          ? {
              declaration: {
                ...event.declaration,
                requiredAbility: reg.metadata.requiredAbility,
              },
            }
          : {}),
      };
      try {
        const res = await chain(decorated);
        const duration = Date.now() - start;
        await this.safeRecordStatus(event.name, res.status);
        const debugLog = session.finalize({
          ok: res.status !== HookResultStatus.Error,
          ...(res.error ? { error: res.error } : {}),
        });
        return {
          ...res,
          durationMs: duration,
          ...(debugLog.length > 0 ? { debugLog } : {}),
        } as HookResult<R>;
      } catch (e) {
        const duration = Date.now() - start;
        const msg = (e as Error)?.message ?? 'Hook execution error';
        await this.safeRecordStatus(event.name, HookResultStatus.Error);
        const debugLog = session.finalize({ error: msg });
        return {
          status: HookResultStatus.Error,
          error: msg,
          durationMs: duration,
          ...(debugLog.length > 0 ? { debugLog } : {}),
        } as HookResult<R>;
      }
    });
    const settled = await Promise.allSettled(tasks);
    return settled.map((s) =>
      s.status === 'fulfilled'
        ? s.value
        : { status: HookResultStatus.Error, error: 'handler crashed' },
    );
  }

  /**
   * 紧贴 handler 的 zod payload 校验; metadata.payloadSchema 缺省时跳过 (兼容存量 hook)
   * @keyword-en run-handler-with-schema
   */
  private async runHandlerWithSchema<T, R>(
    reg: HookRegistration<T, R>,
    event: HookEvent<T>,
  ): Promise<HookResult<R>> {
    const schema = reg.metadata?.payloadSchema;
    if (!schema) return await reg.handler(event);
    const parsed = schema.safeParse(event.payload);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
        .join('; ');
      return {
        status: HookResultStatus.Error,
        error: `payload-schema-invalid: ${detail}`,
      } as HookResult<R>;
    }
    return await reg.handler({ ...event, payload: parsed.data as T });
  }

  private compose<T, R>(
    middlewares: HookMiddleware<T, R>[],
    last: (event: HookEvent<T>) => Promise<HookResult<R>>,
  ) {
    return async (event: HookEvent<T>): Promise<HookResult<R>> => {
      let idx = -1;
      const dispatch = async (i: number): Promise<HookResult<R>> => {
        if (i <= idx) throw new Error('next() called multiple times');
        idx = i;
        const fn = middlewares[i] ?? last;
        return await fn(event, () => dispatch(i + 1));
      };
      return await dispatch(0);
    };
  }

  private async safeRecordStatus(
    hook: string,
    status: HookResultStatus,
  ): Promise<void> {
    try {
      await this.cache.recordStatus(hook, status);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Failed to record hook status for "${hook}": ${msg}`);
    }
  }
}
