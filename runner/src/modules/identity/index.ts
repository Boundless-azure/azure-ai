/**
 * @title Runner Identity Module barrel
 * @description 导出 Runner 端身份/权限相关的服务、中间件、类型。
 * @keywords-cn Runner身份导出, 桶文件
 * @keywords-en runner-identity-exports, barrel
 */
export { RunnerAbilityService } from './services/ability.service';
export { createRunnerHookAbilityMiddleware } from './middleware/hook-ability.middleware';
export { RunnerIdentityRepository } from './repositories/identity.repository';
export {
  ensureSolutionPrincipal,
  ensureAgentPrincipal,
} from './helpers/solution-principal.helper';
export {
  RunnerPrincipalType,
  RunnerBuiltinRole,
  RunnerPermissionType,
} from './enums/identity.enums';
export { RunnerIdentityCollection } from './enums/collection.enums';
export type {
  RunnerIdentityContext,
  RunnerAbilityRule,
  RunnerDataPermissionRule,
} from './types/identity.types';
export type {
  RunnerPrincipalDoc,
  RunnerRoleDoc,
  RunnerRolePermissionDoc,
  RunnerMembershipDoc,
} from './types/entity.types';
