import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { HookInvokerService } from './hook.invoker.service';
import type { HookEvent, HookResult } from '../types/hook.types';

/**
 * @title Hook 鉴权中间件
 * @description 读取 event.context.token, 用 JwtService 校验后回填 principalId / principalType。
 *              校验失败时仅记日志, 不阻断 (本期不做强制); 后续可按 metadata.requireAuth 收紧。
 *              已经携带 principalId 的事件 (lifecycle 拦截器已解析后写入) 直接跳过, 避免重复校验。
 * @keywords-cn Hook鉴权中间件, token校验, principalId注入
 * @keywords-en hook-auth-middleware, token-verify, principal-injection
 */
@Injectable()
export class HookAuthMiddlewareService implements OnModuleInit {
  private readonly logger = new Logger(HookAuthMiddlewareService.name);

  constructor(
    private readonly invoker: HookInvokerService,
    @Optional() private readonly jwt?: JwtService,
  ) {}

  onModuleInit(): void {
    this.invoker.use(this.getMiddleware());
  }

  private getMiddleware<T, R>() {
    return async (
      event: HookEvent<T>,
      next: () => Promise<HookResult<R>>,
    ): Promise<HookResult<R>> => {
      const ctx = event.context ?? {};
      const alreadyResolved = Boolean(ctx.principalId);
      const token = ctx.token;
      if (!alreadyResolved && token && this.jwt) {
        try {
          const payload = this.jwt.verify<{ id?: string; type?: string }>(
            token,
          );
          if (payload?.id) {
            event.context = {
              ...ctx,
              principalId: payload.id,
              principalType: payload.type,
            };
          }
        } catch (e) {
          this.logger.warn(
            `[hook-auth] token verify failed for hook=${event.name}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
      return await next();
    };
  }
}
