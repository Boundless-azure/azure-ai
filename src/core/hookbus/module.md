模块名称：core/hookbus（HookBus 模块）

概述
- 提供本地队列的 Hook 总线，支持注册/筛选/调用与中间件链，并提供状态缓存。
- 每个进程维护独立的 Hook 队列，不进行跨进程分发；慢钩子并行执行，不阻塞其他钩子。

文件清单（File List）
- core/hookbus/enums/hook.enums.ts
- core/hookbus/types/hook.types.ts
- core/hookbus/decorators/hook-handler.decorator.ts
- core/hookbus/decorators/hook-lifecycle.decorator.ts
- core/hookbus/controllers/hookbus-debug.controller.ts
- core/hookbus/controllers/hookbus-debug.gateway.ts
- core/hookbus/services/hook.registry.service.ts
- core/hookbus/services/hook.invoker.service.ts
- core/hookbus/services/hook.bus.service.ts
- core/hookbus/services/hook.debug-state.service.ts
- core/hookbus/services/hook.validation-middleware.service.ts
- core/hookbus/services/hook.lifecycle-registration.service.ts
- core/hookbus/services/hook.decorator-explorer.service.ts
- core/hookbus/interceptors/hook-lifecycle.interceptor.ts
- core/hookbus/hookbus.module.ts
- core/hookbus/cache/hook.cache.ts

函数清单（Function Index）
- HookRegistryService.register(name, handler, metadata)
- HookRegistryService.get(name)
- HookInvokerService.invoke(ctx, regs)
- HookInvokerService.use(mw)
- HookBusService.register(name, handler, metadata)
- HookBusService.emit(event)
- HookBusService.select(name, filter)
- HookBusService.onDebug(listener)
- HookValidationMiddlewareService.onModuleInit()
- HookLifecycleRegistrationService.onModuleInit()
- HookLifecycleInterceptor.intercept(context, next)
- HookDecoratorExplorerService.onModuleInit()
- HookDebugStateService.getEnabled()
- HookDebugStateService.setEnabled(next)
- HookbusDebugController.getState()
- HookbusDebugController.setState(body)
- HookbusDebugGateway.onList(socket)
- HookbusDebugGateway.onEmit(socket, payload)
- HookCacheService.recordStatus(hook, status)
- HookCacheService.getStatus(hook)

关键词索引（中文 / English Keyword Index）
Hook枚举 -> core/hookbus/enums/hook.enums.ts
Hook类型定义 -> core/hookbus/types/hook.types.ts
Hook装饰器 -> core/hookbus/decorators/hook-handler.decorator.ts
Hook生命周期装饰器 -> core/hookbus/decorators/hook-lifecycle.decorator.ts
Hook调试控制器 -> core/hookbus/controllers/hookbus-debug.controller.ts
Hook调试网关 -> core/hookbus/controllers/hookbus-debug.gateway.ts
Hook注册服务 -> core/hookbus/services/hook.registry.service.ts
Hook调用器 -> core/hookbus/services/hook.invoker.service.ts
Hook总线服务 -> core/hookbus/services/hook.bus.service.ts
Hook调试状态服务 -> core/hookbus/services/hook.debug-state.service.ts
Hook校验中间件 -> core/hookbus/services/hook.validation-middleware.service.ts
Hook生命周期注册服务 -> core/hookbus/services/hook.lifecycle-registration.service.ts
Hook装饰器扫描 -> core/hookbus/services/hook.decorator-explorer.service.ts
Hook生命周期拦截器 -> core/hookbus/interceptors/hook-lifecycle.interceptor.ts
HookBus模块 -> core/hookbus/hookbus.module.ts
Hook缓存服务 -> core/hookbus/cache/hook.cache.ts

快速检索映射（Keywords -> Files）
- "hook.bus.service" / "HookBusService" -> src/core/hookbus/services/hook.bus.service.ts
- "hook.invoker.service" / "HookInvokerService" -> src/core/hookbus/services/hook.invoker.service.ts
- "hook.registry.service" / "HookRegistryService" -> src/core/hookbus/services/hook.registry.service.ts
- "hook.types" / "Hook Types" -> src/core/hookbus/types/hook.types.ts
- "hook.enums" / "Hook Enums" -> src/core/hookbus/enums/hook.enums.ts
- "hook.cache" / "Hook Cache" -> src/core/hookbus/cache/hook.cache.ts

关键词到文件函数哈希映射（Keywords -> Function Hash）
- HookBusService.emit -> hb_emit_01
- HookBusService.select -> hb_select_02
- HookInvokerService.invoke -> hb_invoke_03
- HookRegistryService.register -> hb_register_04
- HookBusService.onDebug -> hb_onDebug_05
- HookValidationMiddlewareService.onModuleInit -> hb_validation_mw_06
- HookLifecycleRegistrationService.onModuleInit -> hb_lifecycle_reg_07
- HookLifecycleInterceptor.intercept -> hb_lifecycle_interceptor_08
- HookDecoratorExplorerService.onModuleInit -> hb_decoratorScan_09
- HookDebugStateService.setEnabled -> hb_debugState_set_10
- HookbusDebugController.setState -> hb_debugController_set_11
- HookbusDebugGateway.onEmit -> hb_debugGateway_emit_12
- HookCacheService.recordStatus -> hb_cacheRecord_13
- HookCacheService.getStatus -> hb_cacheGet_14

模块功能描述（Description）
HookBus 模块是系统的事件编排核心，支持同名 Hook 的多插件实现与条件筛选、中间件跟踪与安全治理；采用本地队列模式（多进程独立），不做跨进程分发。处理器并行执行以避免慢钩子阻塞；不依赖数据库表，提供状态缓存与生产者-消费者式发布（emit 返回 Promise 结果）。
