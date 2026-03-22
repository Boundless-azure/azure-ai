模块名称：runner/modules/hookbus（Fastify HookBus 模块）

关键词索引（中文 / English Keyword Index）
HookBus路由 -> modules/hookbus/routes/hookbus.routes.ts
HookBus服务 -> modules/hookbus/services/hookbus.service.ts
HookBus类型 -> modules/hookbus/types/hook.types.ts
HookBus网关 -> modules/hookbus/ws/hookbus.gateway.ts
hookbus-routes -> modules/hookbus/routes/hookbus.routes.ts
hookbus-service -> modules/hookbus/services/hookbus.service.ts
hookbus-gateway -> modules/hookbus/ws/hookbus.gateway.ts

关键词到函数哈希映射（Keywords -> Function Hash）
- registerHookBusRoutes -> runner_hookbus_routes_001
- RunnerHookBusService.register -> runner_hookbus_register_002
- RunnerHookBusService.emit -> runner_hookbus_emit_003
- RunnerHookBusService.onDebug -> runner_hookbus_debug_004
- registerHookBusGateway -> runner_hookbus_gateway_005

模块功能描述（Description）
提供 runner Hook 注册与发布能力，采用生产者-消费者队列执行，支持声明式中间件与方法绑定缓存，并通过 HTTP 与 Socket.IO 暴露调试入口。
