/**
 * @title Identity Module Tip (Web)
 * @description 前端身份模块的描述与关键词映射。
 * @keywords-cn 模块描述, 关键词映射, 哈希对照
 * @keywords-en module-description, keyword-mapping, hash-map
 */

export const moduleTip = {
  description:
    'Identity module provides UI and services for managing principals, organizations, memberships, roles and permissions.',
  keywords: {
    cn: {
      身份管理入口: 'components/IdentityManager.vue',
      用户管理: 'components/UserManagement.vue',
      组织管理: 'components/OrganizationManagement.vue',
      角色管理: 'components/RoleManagement.vue',
      权限管理: 'components/PermissionManagement.vue',
      身份服务: 'services/identity.service.ts',
      身份控制器: 'controller/identity.controller.ts',
      身份类型: 'types/identity.types.ts',
      身份枚举: 'enums/identity.enums.ts',
    },
    en: {
      identity_manager: 'components/IdentityManager.vue',
      user_management: 'components/UserManagement.vue',
      organization_management: 'components/OrganizationManagement.vue',
      role_management: 'components/RoleManagement.vue',
      permission_management: 'components/PermissionManagement.vue',
      identity_service: 'services/identity.service.ts',
      identity_controller: 'controller/identity.controller.ts',
      identity_types: 'types/identity.types.ts',
      identity_enums: 'enums/identity.enums.ts',
    },
  },
  hashes: {
    listPrincipals: 'web_id_list_principals_001',
    listOrganizations: 'web_id_list_orgs_002',
    listRoles: 'web_id_list_roles_003',
    listMemberships: 'web_id_list_members_004',
    upsertRolePermissions: 'web_id_upsert_role_perm_005',
    listPermissionDefinitions: 'web_id_list_perm_def_006',
  },
};
