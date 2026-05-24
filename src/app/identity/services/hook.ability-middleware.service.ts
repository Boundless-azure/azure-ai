import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HookInvokerService } from '@/core/hookbus/services/hook.invoker.service';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import type {
  HookEvent,
  HookRequiredAbility,
  HookResult,
} from '@/core/hookbus/types/hook.types';
import { AbilityService } from './ability.service';

/**
 * @title Hook 能力校验中间件
 * @description 把 HTTP `@CheckAbility` 的鉴权语义平移到 Hook 调用链。
 *              触发条件: declaration.requiredAbility 非空 (由 invoker 从 reg.metadata 镜像), 且 event.context.source === 'llm';
 *              其他来源 (http 已过 AbilityGuard / system / runner 内部) 直接放行, 避免双重校验。
 *              校验失败软返 status=Error, error `permission-denied:<action>:<subject>`,
 *              不抛异常 -- 与 hook 调用统一软错语义保持一致。
 * @keywords-cn Hook能力中间件, 权限校验, LLM鉴权, 软错
 * @keywords-en hook-ability-middleware, ability-check, llm-auth, soft-error
 */
@Injectable()
export class HookAbilityMiddlewareService implements OnModuleInit {
  private readonly logger = new Logger(HookAbilityMiddlewareService.name);

  constructor(
    private readonly invoker: HookInvokerService,
    private readonly ability: AbilityService,
  ) {}

  onModuleInit(): void {
    this.invoker.use(this.getMiddleware());
  }

  /**
   * 把 declaration.requiredAbility 归一成数组形态
   * @keyword-en normalize-required-ability
   */
  private toAbilityList(
    raw: HookRequiredAbility | HookRequiredAbility[] | undefined,
  ): HookRequiredAbility[] {
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  }

  private getMiddleware<T, R>() {
    return async (
      event: HookEvent<T>,
      next: () => Promise<HookResult<R>>,
    ): Promise<HookResult<R>> => {
      const list = this.toAbilityList(event.declaration?.requiredAbility);
      if (list.length === 0) return await next();

      // 只对 LLM 链路兜底; HTTP 路径已过 AbilityGuard, system/runner 触发不卡
      if (event.context?.source !== 'llm') return await next();

      const principalId = event.context?.principalId;
      if (!principalId) {
        this.logger.warn(
          `[hook-ability] missing principalId, hook=${event.name}`,
        );
        return {
          status: HookResultStatus.Error,
          error: 'auth-required',
        } as HookResult<R>;
      }

      try {
        const ability = await this.ability.buildForPrincipal(principalId);
        for (const req of list) {
          const ok = ability.can(req.action, req.subject, { principalId });
          if (!ok) {
            return {
              status: HookResultStatus.Error,
              error: `permission-denied:${req.action}:${req.subject}`,
            } as HookResult<R>;
          }
        }
      } catch (e) {
        this.logger.warn(
          `[hook-ability] ability check failed, hook=${event.name}: ${e instanceof Error ? e.message : String(e)}`,
        );
        return {
          status: HookResultStatus.Error,
          error: 'ability-check-failed',
        } as HookResult<R>;
      }
      return await next();
    };
  }
}
