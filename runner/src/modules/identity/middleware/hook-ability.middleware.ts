import type {
  HookEvent,
  HookMiddleware,
  HookRequiredAbility,
  HookResult,
} from '../../hookbus/types/hook.types';
import { RunnerAbilityService } from '../services/ability.service';

/**
 * @title Runner Hook Ability Middleware (本地优先 + hint fallback + source 分流)
 * @description 校验顺序:
 *              1) denyLlm: source==='llm' + decl.denyLlm=true → 软错拒
 *              2) source 分流:
 *                 - 'system' / 'runner' (内部互调 / runner 自身触发) → 默认放行 (denyLlm 仍生效)
 *                 - 'debug' (HTTP/WS 调试端点) → 必须有 principalId + 本地 ability 校验
 *                 - 'llm' (SaaS 派发) → 本地查 principal; 本地无 → fallback 到 SaaS push hint (extras.identitySaasHint)
 *              3) requiredAbility 非空时校验 can(action, subject), 不通过 → permission-denied
 *
 *              软错语义跟 SaaS HookAbilityMiddleware 保持一致, 不抛异常。
 * @keywords-cn Runner能力中间件, 本地优先, hint回退, source分流, 软错
 * @keywords-en runner-hook-ability-middleware, local-first, hint-fallback, source-split, soft-error
 */
export function createRunnerHookAbilityMiddleware(
  ability: RunnerAbilityService,
): HookMiddleware {
  const toAbilityList = (
    raw: HookRequiredAbility | HookRequiredAbility[] | undefined,
  ): HookRequiredAbility[] => {
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  };

  return async <T, R>(
    event: HookEvent<T>,
    next: () => Promise<HookResult<R>>,
  ): Promise<HookResult<R>> => {
    const decl = event.declaration;
    const source = event.context?.source;
    const isLlm = source === 'llm';
    // 'http' = 通过 runner HTTP/WS hook 调试端点进入 (生产场景这条路只用于调试, 故跟 debug 同语义)
    const isHttpDebug = source === 'http';
    const isInternal = source === 'system' || source === 'runner' || !source;

    // (1) denyLlm 优先级最高: 即便是有 root role 的 LLM 也不能调
    if (isLlm && decl?.denyLlm === true) {
      event.log?.warn?.('llm-denied', { hook: event.name });
      return {
        status: 'error',
        error: `llm-denied: hook "${event.name}" is internal-only (denyLlm=true)`,
      } as HookResult<R>;
    }

    // (2) requiredAbility 校验仅对 llm / http(debug) 生效; internal 互调跳过 (信任内部)
    const list = toAbilityList(decl?.requiredAbility);
    if (isInternal || list.length === 0) return await next();
    void isHttpDebug; // 显式标注: http 走跟 llm 同样的本地优先校验路径, 仅 fallback hint 仅 llm 用

    // (3) principalId 必须存在 (http/debug + llm 都要求)
    const principalId = event.context?.principalId;
    if (!principalId) {
      event.log?.warn?.('auth-required', { hook: event.name, source });
      return {
        status: 'error',
        error: 'auth-required',
      } as HookResult<R>;
    }

    // (4) 本地优先: 查 mongo 拿 principal 的 rules
    const local = await ability.buildForPrincipal(principalId);
    let effectiveCan = local.can;
    let usedSource: 'local' | 'hint' | 'empty' = local.matched ? 'local' : 'empty';

    // (5) 本地无 → llm 路径尝试 SaaS push hint
    if (!local.matched && isLlm) {
      const hint = RunnerAbilityService.extractIdentityHint(
        event.context?.extras,
      );
      if (hint?.abilityRules && hint.abilityRules.length > 0) {
        const fromHint = RunnerAbilityService.fromContext(hint);
        effectiveCan = fromHint.can;
        usedSource = 'hint';
      }
    }

    // (6) 校验 can; 任一不过 → permission-denied
    for (const req of list) {
      if (!effectiveCan(req.action, req.subject)) {
        event.log?.warn?.('permission-denied', {
          hook: event.name,
          action: req.action,
          subject: req.subject,
          principalId,
          usedSource,
        });
        return {
          status: 'error',
          error: `permission-denied:${req.action}:${req.subject}`,
        } as HookResult<R>;
      }
    }
    return await next();
  };
}
