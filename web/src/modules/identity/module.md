# Identity Module（身份管理模块）

## 功能描述

Identity module provides UI and services for managing principals, organizations, memberships, roles and permissions.

## 目录结构

```
src/modules/identity/
├── api/
│   └── agent.ts                   # 身份 API 封装
├── components/
│   ├── IdentityManager.vue        # 身份管理入口
│   ├── IdentitySectionHeader.vue   # 页面标题组件
│   ├── OrganizationManagement.vue  # 组织管理
│   ├── PermissionManagement.vue    # 权限管理
│   ├── RoleManagement.vue          # 角色管理
│   ├── RolePermissionAssign.vue    # 角色权限分配
│   └── UserManagement.vue         # 用户管理
├── constants/
│   └── identity.constants.ts      # 身份常量
├── description/
│   └── module.tip.ts              # 模块提示（开发用）
├── hooks/
│   ├── useMemberships.ts          # 成员 Hook
│   ├── useOrganizations.ts         # 组织 Hook
│   ├── usePermissionDefinitions.ts  # 权限定义 Hook
│   ├── usePrincipals.ts           # 主体 Hook
│   └── useRoles.ts                # 角色 Hook
├── types/
│   └── identity.types.ts          # 类型定义
└── identity.module.ts              # 模块定义
```

## 核心文件与函数

### hooks/usePrincipals.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `list` | 获取主体列表 |
| `listUsers` | 获取用户列表 |
| `create` | 创建主体 |
| `update` | 更新主体 |
| `remove` | 删除主体 |
| `createUser` | 创建用户 |
| `updateUser` | 更新用户 |
| `removeUser` | 删除用户 |

### hooks/useOrganizations.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `list` | 获取组织列表 |
| `create` | 创建组织 |
| `update` | 更新组织 |
| `remove` | 删除组织 |

### hooks/useRoles.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `list` | 获取角色列表 |
| `create` | 创建角色 |
| `update` | 更新角色 |
| `remove` | 删除角色 |
| `upsertPermissions` | 分配权限 |

### hooks/useMemberships.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `list` | 获取成员列表 |
| `add` | 添加成员 |
| `remove` | 移除成员 |

### components/UserManagement.vue

主要区域：
- `user-list` - 用户列表
- `user-avatar-edit` - 用户头像编辑

### components/RolePermissionAssign.vue

主要区域：
- `role-permission-form` - 角色权限分配表单

## 函数哈希映射

| 函数 | Hash |
|------|------|
| `listPrincipals` | `web_id_list_principals_001` |
| `listOrganizations` | `web_id_list_orgs_002` |
| `listRoles` | `web_id_list_roles_003` |
| `listMemberships` | `web_id_list_members_004` |
| `upsertRolePermissions` | `web_id_upsert_role_perm_005` |
| `listPermissionDefinitions` | `web_id_list_perm_def_006` |
| `usePrincipals_list` | `web_id_hook_principals_list_001` |
| `usePrincipals_listUsers` | `web_id_hook_principals_list_users_020` |
| `usePrincipals_create` | `web_id_hook_principals_create_002` |
| `usePrincipals_update` | `web_id_hook_principals_update_003` |
| `usePrincipals_remove` | `web_id_hook_principals_remove_004` |
| `useOrganizations_list` | `web_id_hook_org_list_005` |
| `useOrganizations_create` | `web_id_hook_org_create_006` |
| `useRoles_list` | `web_id_hook_roles_list_009` |
| `useRoles_create` | `web_id_hook_roles_create_010` |
| `useRoles_update` | `web_id_hook_roles_update_011` |
| `useMemberships_list` | `web_id_hook_members_list_014` |
| `useMemberships_add` | `web_id_hook_members_add_015` |
| `UserManagement_onAvatarConfirm` | `web_id_user_mgmt_avatar_confirm_024` |
