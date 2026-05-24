模块名称：core/data-permission（数据权限模块）

概述
- 提供 DTO 方法级的数据权限节点装饰器，可将节点键绑定到 DTO 内置方法。
- 提供 forRoot 注入能力，支持 Record<string, 表名, dto数组> 的 tableDtoMap 配置。
- 提供服务层执行器，按 table + dto + context 调用节点函数并聚合 where 条件。

文件清单（File List）
- core/data-permission/data-permission.module.ts
- core/data-permission/index.ts
- core/data-permission/controllers/data-permission.controller.ts
- core/data-permission/services/data-permission.service.ts
- core/data-permission/services/data-permission.registry.service.ts
- core/data-permission/services/data-permission-context.service.ts
- core/data-permission/decorators/data-permission-node.decorator.ts
- core/data-permission/cache/data-permission.cache.ts
- core/data-permission/entities/data-permission-binding.entity.ts
- core/data-permission/enums/data-permission.enums.ts
- core/data-permission/types/data-permission.types.ts
- core/data-permission/types/tokens.ts
- core/data-permission/description/data-permission.tip.ts

关键词索引（中文 / English Keyword Index）
数据权限模块 -> core/data-permission/data-permission.module.ts
数据权限服务 -> core/data-permission/services/data-permission.service.ts
数据权限注册表 -> core/data-permission/services/data-permission.registry.service.ts
数据权限上下文 -> core/data-permission/services/data-permission-context.service.ts
DTO节点装饰器 -> core/data-permission/decorators/data-permission-node.decorator.ts
数据权限缓存 -> core/data-permission/cache/data-permission.cache.ts
数据权限绑定实体 -> core/data-permission/entities/data-permission-binding.entity.ts
数据权限类型 -> core/data-permission/types/data-permission.types.ts
data-permission-module -> core/data-permission/data-permission.module.ts
data-permission-service -> core/data-permission/services/data-permission.service.ts
data-permission-registry -> core/data-permission/services/data-permission.registry.service.ts
data-permission-context -> core/data-permission/services/data-permission-context.service.ts
dto-node-decorator -> core/data-permission/decorators/data-permission-node.decorator.ts
data-permission-cache -> core/data-permission/cache/data-permission.cache.ts
binding-entity -> core/data-permission/entities/data-permission-binding.entity.ts
data-permission-types -> core/data-permission/types/data-permission.types.ts

关键词到文件函数哈希映射（Keywords -> Function Hash）
- DataPermissionModule.forRoot -> dp_mod_for_root_001
- DataPermissionService.resolve -> dp_svc_resolve_002
- DataPermissionRegistryService.rebuild -> dp_reg_rebuild_003
- DataPermissionRegistryService.getTableDtoHashMap -> dp_reg_hash_map_004
- DataPermissionContextService.build -> dp_ctx_build_005
- BindDataPermissionNode -> dp_dec_bind_node_006
- getDtoNodeBindings -> dp_dec_get_bindings_007
- DataPermissionCache.getTableDtoHashMap -> dp_cache_table_hash_008
- DataPermissionController.listTables -> dp_ctl_tables_009
- DataPermissionController.listBindings -> dp_ctl_bindings_010

模块功能描述（Description）
Data Permission 模块用于在后端服务层执行细粒度数据权限：业务方在 DTO 内置方法上声明节点键（例如 user:create-only-myself），并在模块 forRoot 中注入 tableDtoMap 与节点函数映射。服务在收到 dtoClass 与 context 后，自动定位对应节点并执行，最终输出 allow 与 where 聚合结果，便于在查询与写入前统一裁决数据权限。
