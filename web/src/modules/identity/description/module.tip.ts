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
      身份管理入口: 'src/modules/identity/components/IdentityManager.vue',
      用户管理: 'src/modules/identity/components/UserManagement.vue',
      组织管理: 'src/modules/identity/components/OrganizationManagement.vue',
      角色管理: 'src/modules/identity/components/RoleManagement.vue',
      权限管理: 'src/modules/identity/components/PermissionManagement.vue',
      身份类型: 'src/modules/identity/types/identity.types.ts',
      身份枚举: 'src/modules/identity/constants/identity.constants.ts',
      身份常量: 'src/modules/identity/constants/identity.constants.ts',
      主体hook: 'src/modules/identity/hooks/usePrincipals.ts',
      组织hook: 'src/modules/identity/hooks/useOrganizations.ts',
      角色hook: 'src/modules/identity/hooks/useRoles.ts',
      成员hook: 'src/modules/identity/hooks/useMemberships.ts',
      权限定义hook: 'src/modules/identity/hooks/usePermissionDefinitions.ts',
      身份API适配: 'src/api/agent.ts',
      用户接口: 'src/api/agent.ts',
    },
    en: {
      identity_manager: 'src/modules/identity/components/IdentityManager.vue',
      user_management: 'src/modules/identity/components/UserManagement.vue',
      organization_management:
        'src/modules/identity/components/OrganizationManagement.vue',
      role_management: 'src/modules/identity/components/RoleManagement.vue',
      permission_management:
        'src/modules/identity/components/PermissionManagement.vue',
      identity_types: 'src/modules/identity/types/identity.types.ts',
      identity_enums: 'src/modules/identity/constants/identity.constants.ts',
      identity_constants:
        'src/modules/identity/constants/identity.constants.ts',
      principals_hook: 'src/modules/identity/hooks/usePrincipals.ts',
      organizations_hook: 'src/modules/identity/hooks/useOrganizations.ts',
      roles_hook: 'src/modules/identity/hooks/useRoles.ts',
      memberships_hook: 'src/modules/identity/hooks/useMemberships.ts',
      permission_defs_hook:
        'src/modules/identity/hooks/usePermissionDefinitions.ts',
      permission_definitions_hook:
        'src/modules/identity/hooks/usePermissionDefinitions.ts',
      identity_api_adapter: 'src/api/agent.ts',
      identity_api: 'src/api/agent.ts',
      user_api: 'src/api/agent.ts',
    },
  },
  hashes: {
    listPrincipals: 'web_id_list_principals_001',
    listOrganizations: 'web_id_list_orgs_002',
    listRoles: 'web_id_list_roles_003',
    listMemberships: 'web_id_list_members_004',
    upsertRolePermissions: 'web_id_upsert_role_perm_005',
    listPermissionDefinitions: 'web_id_list_perm_def_006',
    principalSchemas: 'web_id_schema_principal_007',
    organizationSchemas: 'web_id_schema_org_008',
    roleSchemas: 'web_id_schema_role_009',
    membershipSchemas: 'web_id_schema_member_010',
    permissionDefSchemas: 'web_id_schema_permdef_011',
    usePrincipals_list: 'web_id_hook_principals_list_001',
    usePrincipals_listUsers: 'web_id_hook_principals_list_users_020',
    usePrincipals_create: 'web_id_hook_principals_create_002',
    usePrincipals_update: 'web_id_hook_principals_update_003',
    usePrincipals_remove: 'web_id_hook_principals_remove_004',
    usePrincipals_createUser: 'web_id_hook_principals_create_user_021',
    usePrincipals_updateUser: 'web_id_hook_principals_update_user_022',
    usePrincipals_removeUser: 'web_id_hook_principals_remove_user_023',
    useOrganizations_list: 'web_id_hook_org_list_005',
    useOrganizations_create: 'web_id_hook_org_create_006',
    useOrganizations_update: 'web_id_hook_org_update_007',
    useOrganizations_remove: 'web_id_hook_org_remove_008',
    useRoles_list: 'web_id_hook_roles_list_009',
    useRoles_create: 'web_id_hook_roles_create_010',
    useRoles_update: 'web_id_hook_roles_update_011',
    useRoles_remove: 'web_id_hook_roles_remove_012',
    useRoles_upsertPermissions: 'web_id_hook_roles_upsert_013',
    useMemberships_list: 'web_id_hook_members_list_014',
    useMemberships_add: 'web_id_hook_members_add_015',
    useMemberships_remove: 'web_id_hook_members_remove_016',
    usePermissionDefs_list: 'web_id_hook_permdefs_list_017',
    usePermissionDefs_create: 'web_id_hook_permdefs_create_018',
    usePermissionDefs_remove: 'web_id_hook_permdefs_remove_019',
  },
};
