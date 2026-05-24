import {
  RunnerBuiltinRole,
  RunnerPrincipalType,
} from '../enums/identity.enums';
import type { RunnerIdentityRepository } from '../repositories/identity.repository';

/**
 * @title Solution Principal Helper
 * @description 为指定 solution 在 runner mongo 内 lazy 创建 service principal + grant 默认 role,
 *              幂等可重复调。
 *              使用场景:
 *                - Solution 装载 / 升级 / 注册时, 调用方主动调一次 ensureSolutionPrincipal(name)
 *                - Solution 内部走 hook 互调走 source='system' 跳过 ability 校验, 不需要 principal
 *                - 只有当 solution 暴露的 hook 想被 LLM/HTTP 调用时, 才需要确保 principal 存在
 * @keywords-cn Solution主体, 自动建, 幂等
 * @keywords-en solution-principal-ensure, lazy-create, idempotent
 */
export async function ensureSolutionPrincipal(
  repo: RunnerIdentityRepository,
  solutionName: string,
  options?: { displayName?: string; defaultRole?: string },
): Promise<{ principalId: string }> {
  const principalId = `solution:${solutionName}`;
  await repo.upsertPrincipal({
    id: principalId,
    type: RunnerPrincipalType.Solution,
    displayName: options?.displayName ?? `Solution: ${solutionName}`,
    builtin: false,
  });
  await repo.addMembership({
    principalId,
    roleId: options?.defaultRole ?? RunnerBuiltinRole.SolutionDefault,
  });
  return { principalId };
}

/**
 * 同样的 lazy 模式给 agent 用. id 格式 agent:<agentId>, 默认 grant `solution-default` (无独立 agent role).
 * @keyword-en agent-principal-ensure
 */
export async function ensureAgentPrincipal(
  repo: RunnerIdentityRepository,
  agentId: string,
  options?: { displayName?: string; defaultRole?: string },
): Promise<{ principalId: string }> {
  const principalId = `agent:${agentId}`;
  await repo.upsertPrincipal({
    id: principalId,
    type: RunnerPrincipalType.Agent,
    displayName: options?.displayName ?? `Agent: ${agentId}`,
    builtin: false,
  });
  await repo.addMembership({
    principalId,
    roleId: options?.defaultRole ?? RunnerBuiltinRole.SolutionDefault,
  });
  return { principalId };
}
