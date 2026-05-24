模块名称：runner/modules/identity（Runner 身份与权限模块）

概述
- 跟 SaaS app/identity 同语义 + 同构 API, **但是 runner 本地独立维护**, 不依赖 SaaS push。
- 4 张 RBAC mongo 集合: `runner_principals` / `runner_roles` / `runner_role_permissions` / `runner_memberships`
- 内置 principal/role 启动 seed; 业务 service 可通过 `ensureSolutionPrincipal` 给 solution 懒建 service principal
- AbilityService **本地优先 + SaaS push hint 兜底**: LLM 链路调过来时, 优先查本地; 本地无该 principal → fallback 用 ctx.extras.identitySaasHint
- HookAbilityMiddleware 按 source 分流: internal (system/runner) 跳过校验; debug (http) 必须本地校验; llm 走本地优先 + hint fallback; denyLlm 始终对 LLM 生效
- Admin Hooks (denyLlm:true) 暴露 RBAC CRUD: list/upsert/grant/addMembership/invalidateCache; 仅 system/http 调试入口可调

文件清单（File List）
- runner/src/modules/identity/index.ts
- runner/src/modules/identity/types/identity.types.ts (运行时载荷类型 RunnerIdentityContext / RunnerAbilityRule / RunnerDataPermissionRule)
- runner/src/modules/identity/types/entity.types.ts (4 张 mongo 集合 doc 结构)
- runner/src/modules/identity/enums/identity.enums.ts (PrincipalType / BuiltinRole / PermissionType)
- runner/src/modules/identity/enums/collection.enums.ts (RunnerIdentityCollection)
- runner/src/modules/identity/repositories/identity.repository.ts (Mongo CRUD + seedBuiltin)
- runner/src/modules/identity/services/ability.service.ts (本地 buildForPrincipal + 静态 fromContext)
- runner/src/modules/identity/middleware/hook-ability.middleware.ts (source 分流 + 本地优先 + hint fallback)
- runner/src/modules/identity/helpers/solution-principal.helper.ts (ensureSolutionPrincipal / ensureAgentPrincipal lazy 建)
- runner/src/modules/identity/hooks/identity.hooks.ts (denyLlm admin hooks)

函数清单（Function Index）
- RunnerIdentityRepository.upsertPrincipal/getPrincipal/listPrincipals
- RunnerIdentityRepository.upsertRole/findRoleByCode/listRoles
- RunnerIdentityRepository.grantPermission/listPermissionsByRoles
- RunnerIdentityRepository.addMembership/listRoleIdsByPrincipal/listMemberships
- RunnerIdentityRepository.seedBuiltin — 启动期 seed 内置 principal/role/grant; 幂等
- RunnerAbilityService.buildForPrincipal — 本地 mongo 查 rules + 30s cache; matched 标记是否本地命中
- RunnerAbilityService.fromContext — 静态版, 接 SaaS push hint 直出 can/cannot (middleware fallback 用)
- RunnerAbilityService.extractIdentityHint — 从 extras.identitySaasHint 容错读 SaaS push 载荷
- RunnerAbilityService.invalidate — admin hook 改完 RBAC 后清 cache
- createRunnerHookAbilityMiddleware(ability) — 工厂构造; hookBus.use(...) 注册; 顺序: denyLlm → internal pass → list/principal/local/hint fallback → can 校验
- ensureSolutionPrincipal(repo, name) — lazy 建 solution:<name> + grant solution-default
- ensureAgentPrincipal(repo, agentId) — lazy 建 agent:<id> + grant solution-default
- registerIdentityAdminHooks(hookBus, repo, ability) — 注册 runner.system.identity.* 6 个 admin hook (全 denyLlm:true)

类型导出（Types）
- RunnerIdentityContext — 运行时载荷, SaaS push 进 extras.identitySaasHint 用同结构
- RunnerAbilityRule — { action, subject }
- RunnerDataPermissionRule — { table, nodeKey, action?, where? }
- RunnerPrincipalDoc / RunnerRoleDoc / RunnerRolePermissionDoc / RunnerMembershipDoc — mongo 集合 doc

Hook 注册 (runner.system.identity.*, 全 denyLlm:true, 仅 system/http 入口可调)
- runner.system.identity.upsertPrincipal  payload: {id, type, displayName?}
- runner.system.identity.upsertRole       payload: {id, code, name, description?}
- runner.system.identity.grantPermission  payload: {roleId, subject, action, permissionType?, nodeKey?}
- runner.system.identity.addMembership    payload: {principalId, roleId}
- runner.system.identity.invalidateCache  payload: {principalId?}
- runner.system.identity.listPrincipals / listRoles

关键词索引（中文 / English Keyword Index）

| 中文关键词 | English Keywords |
|---|---|
| Runner身份 | runner-identity |
| 本地RBAC | local-rbac |
| 能力服务 | ability-service |
| 权限中间件 | hook-ability-middleware |
| source分流 | source-based-routing |
| 本地优先hint回退 | local-first-hint-fallback |
| 数据权限 | data-permissions |
| 拒绝LLM | deny-llm |
| 内置主体 | builtin-principal |
| Solution主体 | solution-principal |
| 启动种子 | seed-builtin-identity |
| 缓存失效 | invalidate-cache |
| 管理钩子 | admin-hooks |

模块功能描述（Description）
Runner 是独立运行时, 不假定 SaaS 一定可达。RBAC 数据 (principals/roles/role_permissions/memberships) 全部存 runner 本地 mongo, 跟 SaaS 端 identity 模块结构同构但精简。
内置 3 个 principal: `system` (root)、`anonymous-llm` (SaaS push LLM 调用兜底)、按 solution 加载 lazy 建的 `solution:<name>` 主体。
内置 3 个 role: `system-root` (subject:* action:*)、`solution-default` (mongo.read + file.read + solution.read)、`llm-anonymous` (仅 find/read)。
HookAbilityMiddleware 走 source 分流: solution 间互调 (source=system) 直接放行; HTTP/WS 调试端点 (source=http) 必须有 principal + 本地 ability; LLM (source=llm, 由 SaaS 派发) 走本地优先 + SaaS push hint 兜底; denyLlm 始终对 LLM 路径硬拒。
数据权限通过 [data-permission](../data-permission/module.md) 模块的 DataPermissionRegistry/Service 实现, ctx.dataPermissions 由 buildDataPermissionContext(ability) 自动从本地 mongo 求出。
