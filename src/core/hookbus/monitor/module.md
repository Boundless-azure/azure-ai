模块名称：core/hookbus/monitor（HookMonitor 模块）

概述
- 提供 Hook 执行过程的中间件监控与 Web 查询接口，无需数据库，使用内存环形缓冲。
- 采集字段包含：hook 名称、发起位置（文件/行/栈）、接收处理器信息、payload、result 与耗时。

文件清单（File List）
- core/hookbus/monitor/hook-monitor.module.ts
- core/hookbus/monitor/controller/hook.monitor.controller.ts
- core/hookbus/monitor/services/hook.monitor.service.ts
- core/hookbus/monitor/cache/hook.monitor.store.ts
- core/hookbus/monitor/types/hook-monitor.types.ts

函数清单（Function Index）
- HookMonitorService.getMiddleware()
- HookMonitorStoreService.add(record)
- HookMonitorStoreService.list(query)
- HookMonitorStoreService.get(id)
- HookMonitorStoreService.stats(name)

关键词索引（中文 / English Keyword Index）
监控模块 -> core/hookbus/monitor/hook-monitor.module.ts
监控控制器 -> core/hookbus/monitor/controller/hook.monitor.controller.ts
监控服务 -> core/hookbus/monitor/services/hook.monitor.service.ts
监控存储 -> core/hookbus/monitor/cache/hook.monitor.store.ts
监控类型 -> core/hookbus/monitor/types/hook-monitor.types.ts

快速检索映射（Keywords -> Files）
- "hook-monitor.module" / "HookMonitorModule" -> src/core/hookbus/monitor/hook-monitor.module.ts
- "hook.monitor.controller" / "HookMonitorController" -> src/core/hookbus/monitor/controller/hook.monitor.controller.ts
- "hook.monitor.service" / "HookMonitorService" -> src/core/hookbus/monitor/services/hook.monitor.service.ts
- "hook.monitor.store" / "HookMonitorStoreService" -> src/core/hookbus/monitor/cache/hook.monitor.store.ts
- "hook.monitor.types" / "HookMonitor Types" -> src/core/hookbus/monitor/types/hook-monitor.types.ts

关键词到文件函数哈希映射（Keywords -> Function Hash）
- HookMonitorService.getMiddleware -> hm_getMiddleware_01
- HookMonitorStoreService.add -> hm_store_add_02
- HookMonitorStoreService.list -> hm_store_list_03
- HookMonitorStoreService.get -> hm_store_get_04
- HookMonitorStoreService.stats -> hm_store_stats_05

模块功能描述（Description）
HookMonitor 模块为 HookBus 提供可视化监控能力：通过中间件采集执行信息并存入内存缓冲；提供 /hook-monitor/events、/hook-monitor/events/:id 与 /hook-monitor/stats API 以供 Web 展示，无需持久化数据库。
