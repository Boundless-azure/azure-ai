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
- app/identity/services/identity-components.service.ts
- app/identity/controllers/principal.controller.ts
- app/identity/controllers/organization.controller.ts
- app/identity/controllers/role.controller.ts
- app/identity/controllers/membership.controller.ts
- app/identity/controllers/permission-definition.controller.ts
- app/identity/controllers/users.controller.ts
- app/identity/controllers/principal.hook-controller.ts
- app/identity/controllers/organization.hook-controller.ts
- app/identity/controllers/role.hook-controller.ts
- app/identity/controllers/membership.hook-controller.ts
- app/identity/controllers/users.hook-controller.ts
- app/identity/controllers/permission-definition.hook-controller.ts
- app/identity/enums/principal.enums.ts
- app/identity/types/identity.types.ts
- app/identity/identity.module.ts

函数清单（Function Index）
- PrincipalService
  - list(query)
  - listUsers(query)
  - countUsers(query) — 统计可登录用户主体总数，支持 type/tenantId 过滤，返回 { count: number } | keywords: count-users, user-count
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
  - count(query) — 统计角色总数，支持 organizationId 过滤，返回 { count: number } | keywords: count-roles, role-count
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
- IdentityComponentsService
  - userTable (@HookComponent) — Web Component Hook: 表格展示用户列表，支持 q/tenantId/type 过滤；经 ctx.callHook('saas.app.identity.userList') 获取数据，组件不碰 URL/token | keywords: user-table-web-component, identity-components, web-component-hook-declaration
  - roleTable (@HookComponent) — Web Component Hook: 表格展示角色列表，支持 q/organizationId 过滤；内置/自定义类型 badge；经 ctx.callHook('saas.app.identity.roleList') 获取数据，组件不碰 URL/token | keywords: role-table-web-component, identity-components
- Identity Hook Controllers（hook 声明层, 与 HTTP controller 解耦; HTTP controller 仅留 @Controller/@Get/@Post/... + @CheckAbility, 不再挂 @HookController/@HookRoute）
  - 每个 hook-controller 声明 `@Injectable() @HookController({ pluginName: 'identity', tags: ['identity', <resource>] })`, 注入与原 controller 相同的 service/repository
  - HookRoute: 单对象 payload (args 恰好一个 object schema); id 类型平铺为 { id }; id+body 平铺为 idField.merge(BodySchema); handler 形参 (payload, _principal, context?)
  - rolePermissionUpsert 的 operatorId 从 context?.principalId 解析 (原 HTTP 用 req.user?.id)
    · 命名遵循 saas.app.identity.<resource><Action>:
    · saas.app.identity.userCount (GET /identity/users/count) — 返回 { count: number }，支持 type/tenantId 过滤
    · saas.app.identity.userList/userCreate/userUpdate/userDelete (× 4)  filter :: q / tenantId / type
    · saas.app.identity.roleCount (GET /identity/roles/count) — 返回 { count: number }，支持 organizationId 过滤
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
- PrincipalService.listUsers -> id_psi_list_users_006（用户管理列表；未指定 type 时查询 DB 类型 user/consumer/system）
- PrincipalService.createUser -> id_psi_create_user_007
- PrincipalService.updateUser -> id_psi_update_user_008（更新用户资料；password 非空时重置登录密码）
- PrincipalService.deleteUser -> id_psi_delete_user_009
- OrganizationService.list -> id_org_list_002
- RoleService.upsertPermissions -> id_role_upsert_perm_003
- AbilityService.buildForRoles -> id_ability_build_004
 - AbilityService.buildForPrincipal -> id_ability_build_005
- RoleHookController.create(HookRoute) -> id_hook_role_create_010
- MembershipHookController.add(HookRoute) -> id_hook_membership_add_011
- PermissionDefinitionHookController.create(HookRoute) -> id_hook_perm_def_create_012
- HookAbilityMiddlewareService.onModuleInit -> id_hook_ability_mw_013

模块功能描述（Description）
本模块统一了 B2B 与 B2C 的身份与权限模型：所有交互主体均为 Principal，通过 principalType 区分企业用户/消费者/官方账号/Agent/系统。组织与成员关系管理采用 RBAC（Role + RolePermission），结合资源级 ACL（由业务模块维护）进行权限决策。AbilityService 提供 can/cannot 能力检查，并可后续替换为 CASL 原生实现。
