模块名称：runner/modules/hookbus（Fastify HookBus 模块）

关键词索引（中文 / English Keyword Index）
HookBus路由 -> modules/hookbus/routes/hookbus.routes.ts
HookBus服务 -> modules/hookbus/services/hookbus.service.ts
HookBus类型 -> modules/hookbus/types/hook.types.ts
HookBus网关 -> modules/hookbus/ws/hookbus.gateway.ts
HookRPC客户端 -> modules/hookbus/ws/hook-rpc.client.ts
HookLifecycle注册中心 -> modules/hookbus/lifecycle/registry.ts
hookbus-routes -> modules/hookbus/routes/hookbus.routes.ts
hookbus-service -> modules/hookbus/services/hookbus.service.ts
hookbus-gateway -> modules/hookbus/ws/hookbus.gateway.ts
hook-rpc-client -> modules/hookbus/ws/hook-rpc.client.ts
hook-lifecycle-registry -> modules/hookbus/lifecycle/registry.ts

关键词到函数哈希映射（Keywords -> Function Hash）
- registerHookBusRoutes -> runner_hookbus_routes_001
- RunnerHookBusService.register -> runner_hookbus_register_002
- RunnerHookBusService.emit -> runner_hookbus_emit_003
- RunnerHookBusService.onDebug -> runner_hookbus_debug_004
- registerHookBusGateway -> runner_hookbus_gateway_005
- attachHookRpc -> runner_hookbus_rpc_attach_006
- registerMetaHooks -> runner_hookbus_meta_register_007
- runner.system.hookbus.search (meta) -> runner_hookbus_meta_search_008
- runner.system.hookbus.getTag (meta) -> runner_hookbus_meta_tag_009
- runner.system.hookbus.getInfo (meta) -> runner_hookbus_meta_info_010
- RunnerHookBusService.unregister -> runner_hookbus_unregister_011
- HookLifecycleRegistry.declare -> runner_hookbus_lifecycle_declare_012
- HookLifecycleRegistry.undeclare -> runner_hookbus_lifecycle_undeclare_013
- HookLifecycleRegistry.report -> runner_hookbus_lifecycle_report_014
- HookLifecycleRegistry.list -> runner_hookbus_lifecycle_list_015

类型导出（Types, 与 SaaS 端语义对齐）
- HookEvent<T>           -- name + payload + context + filter + declaration + log
- HookInvocationContext  -- token / principalId / principalType / source / traceId / runnerId / ts / extras
                            extras.debug=true 触发 OTel sandbox tracer (hook-rpc.client 把 envelope.debug 写在这里)
- HookHandler<T,R>       -- (event) => HookResult
- HookMiddleware<T,R>    -- (event, next) => HookResult
- HookRequiredAbility    -- { action, subject }; metadata.requiredAbility 透传给 SaaS HookAbilityMiddleware 校验
- HookLog                -- handler 可见的日志接口: trace/debug/info/warn/error/event(name, attrs?)
                            hookbus.service 注入到 event.log; 实现见 modules/observability/hook-log.factory.ts
- HookLogEntry           -- drain 出来的单条 { ts, level, message, attrs? }; 写到 HookResult.debugLog
- HookLogSession         -- { log, finalize({ ok?, error? }) => HookLogEntry[] }
- HookResult.debugLog?   -- HookLogEntry[]; debug=true 时由 hookbus.service drain 注入

模块功能描述（Description）
提供 runner Hook 注册与发布能力，采用生产者-消费者队列执行，支持声明式中间件与方法绑定缓存，
并通过 HTTP 与 Socket.IO 暴露调试入口。handler / middleware 签名与 SaaS 端完全一致, 都是 (event, next?) => HookResult。

日志通道 (event.log, OTel-backed, debug 开关) — 与 SaaS 同构:
- HookEvent.log 由 hookbus.service.consumeTask 在每次命中 reg 派发前注入, 不会为 undefined
- debug=false (默认): 单例 NOOP_HOOK_LOG, 全部方法 no-op, 零开销; HookResult.debugLog 缺省
- debug=true: 为该次调用造一次性 BasicTracerProvider + InMemorySpanExporter (modules/observability),
  log.* → SpanEvent; handler 完成 finalize 同步 end span + 投影 SpanEvent 为 HookLogEntry[] 写到 result.debugLog
- debug 信号链路: SaaS call-hook.tools → envelope.debug → hook-rpc.client.ts (写到 context.extras.debug=true)
  → hookbus.service.consumeTask 创建 session → handler 写 → adaptResults 拍平合并到 reply.debugLog 回 SaaS
- CLAUDE.md 强约束: handler 禁 console.log / 独立 LogRecord, 一律走 event.log

payload schema 校验 (zod, SSOT):
- 注册时通过 metadata.payloadSchema 声明 zod schema; consumeTask -> runHandlerWithSchema 在 handler 执行前自动 safeParse
- 校验失败返回 `payload-schema-invalid: <field>: <message>`, 不进入 handler
- 与 SaaS 端 HookInvokerService.runHandlerWithSchema 行为对齐

声明式 lifecycle 注册中心 (lifecycle/registry.ts):
- 不依赖装饰器/反射, 纯函数声明; 应用通过 HookLifecycleRegistry 三个口子接入
- declare(decl)         -- 上报 hook 声明, 同名幂等替换 (按 LIFECYCLE_TAG 清同源旧 hookBus 注册)
- undeclare(hookName)   -- 应用主动撤销
- report(name, env, ctx?) -- 业务方法完成时上报 envelope { input, meta?, ok?, result?, error? }
- payloadSchema 自动包成 envelope schema 落 hookBus.metadata, 与 SaaS @HookLifecycle 行为对齐
- requiredAbility 字段透传到 metadata, Runner 不本地校验, SaaS 派发前由 HookAbilityMiddleware 校验
- 声明落 hookBus 后即可被 runner.system.hookbus.search / runner.system.hookbus.getInfo 元 hook 看见; SaaS 不维护 runner 镜像,
  LLM 调用前用元 hook 自查即可 (getInfo 返回 item 含 requiredAbility, LLM 知道权限要求)
- hookBus.unregister(name, predicate?) 是热替换的底座, 默认整组移除, 传 predicate 仅清匹配项

通过 attachHookRpc 在已建立的 socket-client 上挂载 hook-rpc 协议:
- 监听 hook:call, emit hook:ack (即刻), 3s 周期合并 push hook:progress (callIds[]), 完成 emit hook:result
- envelope.context 透传给 hookBus.emit, handler 通过 event.context 读 token / principalId / traceId
- 自动注册 3 个元 hook (runner.system.hookbus.search / runner.system.hookbus.getTag / runner.system.hookbus.getInfo), 三者均支持 cursor 翻页
- runner.system.hookbus.search 接受 tags: string[] (任一命中), pluginName 过滤; 默认/上限 100
- runner.system.hookbus.getTag 默认/上限 400 (一次拿全景, 作为 LLM 发现链路起点)
- runner.system.hookbus.getInfo 通过 zod v4 z.toJSONSchema 从 metadata.payloadSchema 派生 JSON Schema
- 统一返回外形 { errorMsg: string[], result: unknown, debugLog: unknown[] }, errorMsg 非空即软错
