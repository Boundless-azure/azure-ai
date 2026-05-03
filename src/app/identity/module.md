模块名称：app/identity（统一身份与权限模块）

概述
- 提供统一主体（Principal）、组织（Organization）、成员关系（Membership）、角色（Role）与角色权限（RolePermission）的持久化与接口。
- 提供 AbilityService（CASL 兼容设计）用于 can/cannot 能力判断。

文件清单（File List）
- app/identity/entities/principal.entity.ts
- app/identity/entities/organization.entity.ts
- app/identity/entities/membership.entity.ts
- app/identity/entities/role.entity.ts
- app/identity/entities/role-permission.entity.ts
- app/identity/entities/user.entity.ts
- app/identity/services/principal.service.ts
- app/identity/services/organization.service.ts
- app/identity/services/role.service.ts
- app/identity/services/ability.service.ts
- app/identity/services/hook.ability-middleware.service.ts
- app/identity/controllers/principal.controller.ts
- app/identity/controllers/organization.controller.ts
- app/identity/controllers/role.controller.ts
- app/identity/controllers/membership.controller.ts
- app/identity/controllers/permission-definition.controller.ts
- app/identity/controllers/users.controller.ts
- app/identity/enums/principal.enums.ts
- app/identity/types/identity.types.ts
- app/identity/identity.module.ts

函数清单（Function Index）
- PrincipalService
  - list(query)
  - listUsers(query)
  - create(dto)
  - createUser(dto)
  - update(id, dto)
  - updateUser(id, dto)
  - delete(id)
  - deleteUser(id)
- OrganizationService
  - list(query)
  - create(dto)
  - update(id, dto)
  - delete(id)
- RoleService
  - list()
  - create(dto)
  - update(id, dto)
  - delete(id)
  - listPermissions(roleId)
  - upsertPermissions(roleId, dto)
- AbilityService
  - buildForRoles(roleIds)
  - buildForPrincipal(principalId)
  - getHandle()
- HookAbilityMiddlewareService
  - onModuleInit()  -- 注入 invoker.use, 把 @CheckAbility 语义平移到 Hook 调用链 (仅 source==='llm')
- Identity Controllers
  - HookLifecycle on RBAC CRUD: 全部声明 zod payloadSchema (input 形状), 每个字段带 .describe(), lifecycle-registration 自动包成 envelope
    · 命名遵循 saas.app.identity.<resource><Action>:
    · saas.app.identity.userList/userCreate/userUpdate/userDelete (× 4)  filter :: q / tenantId / type
    · saas.app.identity.roleList/roleCreate/roleUpdate/roleDelete + rolePermissionList/rolePermissionUpsert (× 6)  list filter :: q (LIKE name/code) / organizationId ("null"=系统级)
    · saas.app.identity.principalList/principalCreate/principalUpdate/principalDelete (× 4)  list filter :: q / type / tenantId
    · saas.app.identity.permissionDefinitionList/Create/Update/Delete (× 4)  list filter :: permissionType / nodeKey / fid (null=root); extraData 用 catchall schema 替代裸 z.record
    · saas.app.identity.organizationList/Create/Update/Delete (× 4)  list filter :: q (LIKE name/code)
    · saas.app.identity.membershipList/membershipCreate/membershipDelete (× 3)  list filter :: organizationId / principalId / roleId / active

关键词索引（中文 / English Keyword Index）
统一主体 -> app/identity/entities/principal.entity.ts
组织租户 -> app/identity/entities/organization.entity.ts
成员关系 -> app/identity/entities/membership.entity.ts
角色定义 -> app/identity/entities/role.entity.ts
角色权限 -> app/identity/entities/role-permission.entity.ts
能力服务 -> app/identity/services/ability.service.ts
Hook能力中间件 -> app/identity/services/hook.ability-middleware.service.ts

关键词到文件函数哈希映射（Keywords -> Function Hash）
- PrincipalService.list -> id_psi_list_001
- PrincipalService.listUsers -> id_psi_list_users_006
- PrincipalService.createUser -> id_psi_create_user_007
- PrincipalService.updateUser -> id_psi_update_user_008
- PrincipalService.deleteUser -> id_psi_delete_user_009
- OrganizationService.list -> id_org_list_002
- RoleService.upsertPermissions -> id_role_upsert_perm_003
- AbilityService.buildForRoles -> id_ability_build_004
 - AbilityService.buildForPrincipal -> id_ability_build_005
- RoleController.create(HookLifecycle) -> id_hook_role_create_010
- MembershipController.add(HookLifecycle) -> id_hook_membership_add_011
- PermissionDefinitionController.create(HookLifecycle) -> id_hook_perm_def_create_012
- HookAbilityMiddlewareService.onModuleInit -> id_hook_ability_mw_013

模块功能描述（Description）
本模块统一了 B2B 与 B2C 的身份与权限模型：所有交互主体均为 Principal，通过 principalType 区分企业用户/消费者/官方账号/Agent/系统。组织与成员关系管理采用 RBAC（Role + RolePermission），结合资源级 ACL（由业务模块维护）进行权限决策。AbilityService 提供 can/cannot 能力检查，并可后续替换为 CASL 原生实现。
