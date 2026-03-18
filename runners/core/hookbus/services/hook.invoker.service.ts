import { Injectable } from '@nestjs/common';
import { HookResultStatus } from '../enums/hook.enums';
import type {
  HookContext,
  HookRegistration,
  HookMiddleware,
  HookResult,
} from '../types/hook.types';
import { HookCacheService } from '../cache/hook.cache';

/**
 * @title Hook 调用器服务
 * @description 执行 Hook 中间件链与处理器，并记录最近状态到缓存。
 * @keywords-cn Hook调用, 中间件链, 状态缓存
 * @keywords-en hook-invoker, middleware-chain, status-cache
 */
@Injectable()
export class HookInvokerService {
  private middlewares: HookMiddleware[] = [];

  constructor(private readonly cache: HookCacheService) {}

  use(mw: HookMiddleware): void {
    this.middlewares.push(mw);
  }

  async invoke<T, R>(
    ctx: HookContext<T>,
    regs: HookRegistration<T, R>[],
  ): Promise<HookResult<R>[]> {
    if (!regs.length) {
      await this.safeRecordStatus(ctx.event.name, HookResultStatus.Skipped);
      return [{ status: HookResultStatus.Skipped }];
    }

    const tasks = regs.map(async (reg) => {
      const start = Date.now();
      const ctxWithMeta: HookContext<T> = {
        event: ctx.event,
        metadata: reg.metadata,
        state: { ...(ctx.state ?? {}), regId: reg.id },
      };
      const chain = this.compose([...this.middlewares], async () =>
        reg.handler(ctxWithMeta),
      );
      try {
        const res = await chain(ctxWithMeta);
        const duration = Date.now() - start;
        await this.safeRecordStatus(ctx.event.name, res.status);
        return { ...res, durationMs: duration } as HookResult<R>;
      } catch (e) {
        const duration = Date.now() - start;
        const msg = (e as Error)?.message ?? 'Hook execution error';
        await this.safeRecordStatus(ctx.event.name, HookResultStatus.Error);
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
    last: (ctx: HookContext<T>) => Promise<HookResult<R>>,
  ) {
    return async (ctx: HookContext<T>): Promise<HookResult<R>> => {
      let idx = -1;
      const dispatch = async (i: number): Promise<HookResult<R>> => {
        if (i <= idx) throw new Error('next() called multiple times');
        idx = i;
        const fn = middlewares[i] ?? last;
        return await fn(ctx, () => dispatch(i + 1));
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
    } catch {
      void 0;
    }
  }
}
