模块名称：runner/unit-core（Unit 能力基座模块）

关键词索引（中文 / English Keyword Index）
UnitCore服务 -> unit-core/services/unit-core.service.ts
Unit加载器 -> unit-core/services/unit-loader.service.ts
Unit注册器 -> unit-core/services/unit-registry.service.ts
Unit类型定义 -> unit-core/types/unit.types.ts
Unit系统能力 -> unit-core/system-unit
unit-core-service -> unit-core/services/unit-core.service.ts
unit-loader -> unit-core/services/unit-loader.service.ts
unit-registry -> unit-core/services/unit-registry.service.ts
unit-types -> unit-core/types/unit.types.ts

关键词到函数哈希映射（Keywords -> Function Hash）
- UnitCoreService.init -> unit_core_init_001
- UnitCoreService.executeHook -> unit_core_execute_002
- UnitCoreService.registerToHookBus -> unit_core_hookbus_003
- UnitCoreService.persistHooks -> unit_core_persist_004
- UnitRegistryService.scanUnits -> unit_registry_scan_005
- UnitLoaderService.loadCoreModule -> unit_loader_core_006

模块功能描述（Description）
Unit Core 模块作为 runner 的能力基座，负责扫描 workspace 与 system-unit 的 Hook 描述并注册至 HookBus，同时按需热加载 unit.core 实现并持久化能力清单。

registerToHookBus 把 unit.hook.ts 声明的 `payloadSchema` (zod) 透传到 metadata, 这样:
- HookBus invoker 在 handler 前自动 safeParse
- LLM 通过 runner.system.hookbus.getInfo 拿到的 payloadSchema 即来自此字段 (z.toJSONSchema 派生)
