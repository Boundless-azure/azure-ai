/**
 * @title Runner Identity Collection 枚举
 * @description Runner mongo 上 RBAC 相关 collection 名常量, identity 模块自治管理 (不污染 runner-db 模块基础设施).
 * @keywords-cn 集合常量, RBAC
 * @keywords-en collection-enums, rbac
 */

export enum RunnerIdentityCollection {
  Principal = 'runner_principals',
  Role = 'runner_roles',
  RolePermission = 'runner_role_permissions',
  Membership = 'runner_memberships',
}
