模块名称：runner/modules/data-permission（Runner 数据权限模块）

概述
- 跟 SaaS core/data-permission 同语义, **纯函数声明 (无装饰器/反射), 适配 runner Fastify+纯函数风格**.
- 三件套: `DataPermissionRegistry` (内存绑定) + `DataPermissionService` (resolve 入口) + `buildDataPermissionContext` (从 ability 求 ctx).
- 节点函数签名 `(ctx) => { allow, where? }`; service 把同 (table, action) 上的所有 binding 求出来 `$and` 合并成最终 mongo filter.
- ctx.dataPermissions 来自 `RunnerAbilityService.buildForPrincipal(principalId).dataPermissions` (从本地 mongo permissionType=Data 求出, 同样支持 SaaS push hint fallback).

文件清单（File List）
- runner/src/modules/data-permission/index.ts
- runner/src/modules/data-permission/types/data-permission.types.ts (Context / NodeFn / NodeResult / Binding / ResolveResult)
- runner/src/modules/data-permission/services/data-permission.registry.ts (DataPermissionRegistry + dataPermissionRegistry 单例)
- runner/src/modules/data-permission/services/data-permission.service.ts (DataPermissionService.resolve)
- runner/src/modules/data-permission/helpers/context.helper.ts (buildDataPermissionContext)

函数清单（Function Index）
- DataPermissionRegistry.bind(binding) — 注册一条 binding (table+action+nodeKey → node fn); 幂等覆盖 | keywords: register-binding
- DataPermissionRegistry.unbind(table, action, nodeKey) — 热卸载 | keywords: unbind
- DataPermissionRegistry.lookup(table, action, nodeKeys[]) — 查匹配的 binding 数组 | keywords: lookup-bindings
- DataPermissionRegistry.listAll() — debug 列出所有 binding | keywords: list-bindings
- DataPermissionService.resolve(table, action, ctx) — 求最终 mongo filter; 无 binding 默认放开 | keywords: resolve, mongo-filter-merge
- buildDataPermissionContext(ability, args) — 工厂; 输入 principalId 出 ctx | keywords: data-permission-context-factory

类型导出（Types）
- DataPermissionContext — { principalId, tenantId?, dataPermissions[], attributes? }
- DataPermissionNodeFn — (ctx) => { allow, where? }
- DataPermissionBinding — { table, action, nodeKey, fn, description? }
- DataPermissionResolveResult — { allow, filter, matchedNodes[] }

关键词索引（中文 / English Keyword Index）

| 中文关键词 | English Keywords |
|---|---|
| Runner数据权限 | runner-data-permission |
| 节点绑定 | node-binding |
| 注册表 | registry |
| mongo filter | mongo-filter |
| 上下文工厂 | context-factory |
| allow短路 | allow-shortcut |
| 纯函数声明 | declarative-fn-style |

模块功能描述（Description）
Solution / runner 业务模块在启动时通过 `dataPermissionRegistry.bind({ table, action, nodeKey, fn })` 把数据权限节点函数注册进来 (跟 SaaS @BindDataPermissionNode 同语义, 纯函数风格).
执行 mongo CRUD 前, 业务 service 走 `buildDataPermissionContext(ability, { principalId })` 拿 ctx, 然后 `service.resolve(table, action, ctx)` 拿 `{ allow, filter, matchedNodes }`:
  - allow=false → 拒绝操作 (查空 / 写抛错)
  - allow=true filter={} → 无限制
  - allow=true filter=<mongo where> → 拼到 mongo 查询里 (find/updateMany/deleteMany)

跟 SaaS 不同点:
  - SaaS 用 @BindDataPermissionNode 装饰 DTO 类方法, runner 用 dataPermissionRegistry.bind 纯函数注册
  - SaaS 节点函数定位通过 dto class hash, runner 直接 (table+action+nodeKey) 三元组
  - 默认策略 SaaS 和 runner 都是"无定义=放开", 业务方可在 service 层覆写"无定义=拒绝"

依赖
- 强依赖 `[modules/identity](../identity/module.md)` 的 RunnerAbilityService 求 dataPermissions
- 不直接依赖 mongo (binding fn 自己决定怎么生成 where; service 只做合并)
