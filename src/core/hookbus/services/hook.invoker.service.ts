import { Injectable, Logger } from '@nestjs/common';
import { HookResultStatus } from '../enums/hook.enums';
import type {
  HookEvent,
  HookRegistration,
  HookMiddleware,
  HookResult,
} from '../types/hook.types';
import { HookCacheService } from '../cache/hook.cache';

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

    const tasks = regs.map(async (reg) => {
      const start = Date.now();
      const eventMws = (event.declaration?.middlewares ?? [])
        .map((name) => this.namedMiddlewares.get(name))
        .filter((item): item is HookMiddleware<T, R> => Boolean(item));
      const chain = this.compose<T, R>(
        [...eventMws, ...this.middlewares] as HookMiddleware<T, R>[],
        async () => reg.handler(event),
      );
      try {
        const res = await chain(event);
        const duration = Date.now() - start;
        await this.safeRecordStatus(event.name, res.status);
        return { ...res, durationMs: duration } as HookResult<R>;
      } catch (e) {
        const duration = Date.now() - start;
        const msg = (e as Error)?.message ?? 'Hook execution error';
        await this.safeRecordStatus(event.name, HookResultStatus.Error);
        return {
          status: HookResultStatus.Error,
          error: msg,
          durationMs: duration,
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
