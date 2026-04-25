模块名称：runner/modules/hookbus（Fastify HookBus 模块）

关键词索引（中文 / English Keyword Index）
HookBus路由 -> modules/hookbus/routes/hookbus.routes.ts
HookBus服务 -> modules/hookbus/services/hookbus.service.ts
HookBus类型 -> modules/hookbus/types/hook.types.ts
HookBus网关 -> modules/hookbus/ws/hookbus.gateway.ts
HookRPC客户端 -> modules/hookbus/ws/hook-rpc.client.ts
hookbus-routes -> modules/hookbus/routes/hookbus.routes.ts
hookbus-service -> modules/hookbus/services/hookbus.service.ts
hookbus-gateway -> modules/hookbus/ws/hookbus.gateway.ts
hook-rpc-client -> modules/hookbus/ws/hook-rpc.client.ts

关键词到函数哈希映射（Keywords -> Function Hash）
- registerHookBusRoutes -> runner_hookbus_routes_001
- RunnerHookBusService.register -> runner_hookbus_register_002
- RunnerHookBusService.emit -> runner_hookbus_emit_003
- RunnerHookBusService.onDebug -> runner_hookbus_debug_004
- registerHookBusGateway -> runner_hookbus_gateway_005
- attachHookRpc -> runner_hookbus_rpc_attach_006
- registerMetaHooks -> runner_hookbus_meta_register_007
- search_hook (meta) -> runner_hookbus_meta_search_008
- get_hook_tag (meta) -> runner_hookbus_meta_tag_009
- get_hook_info (meta) -> runner_hookbus_meta_info_010

类型导出（Types, 与 SaaS 端语义对齐）
- HookEvent<T>           -- name + payload + context + filter + declaration
- HookInvocationContext  -- token / principalId / principalType / source / traceId / runnerId / ts / extras
- HookHandler<T,R>       -- (event) => HookResult
- HookMiddleware<T,R>    -- (event, next) => HookResult

模块功能描述（Description）
提供 runner Hook 注册与发布能力，采用生产者-消费者队列执行，支持声明式中间件与方法绑定缓存，
并通过 HTTP 与 Socket.IO 暴露调试入口。handler / middleware 签名与 SaaS 端完全一致, 都是 (event, next?) => HookResult。

通过 attachHookRpc 在已建立的 socket-client 上挂载 hook-rpc 协议:
- 监听 hook:call, emit hook:ack (即刻), 3s 周期合并 push hook:progress (callIds[]), 完成 emit hook:result
- envelope.context 透传给 hookBus.emit, handler 通过 event.context 读 token / principalId / traceId
- 自动注册 3 个元 hook (search_hook / get_hook_tag / get_hook_info), 三者均支持 cursor 翻页
- search_hook 接受 tags: string[] (任一命中), pluginName 过滤
- get_hook_info 通过 zod v4 z.toJSONSchema 从 metadata.payloadSchema 派生 JSON Schema
- 统一返回外形 { errorMsg: string[], result: unknown, debugLog: unknown[] }, errorMsg 非空即软错
