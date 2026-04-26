模块名称：core/hookbus（HookBus 模块）

概述
- 提供本地队列的 Hook 总线，支持注册/筛选/调用与中间件链，并提供状态缓存。
- 每个进程维护独立的 Hook 队列，不进行跨进程分发；慢钩子并行执行，不阻塞其他钩子。
- 与 Runner 端 hookbus 共用同一套类型语义: `HookEvent` 携带 payload (业务) + context (运行时, LLM 不可见),
  handler 直接接收 `event` 而非 ctx wrapper。

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
- core/hookbus/services/hook.auth-middleware.service.ts
- core/hookbus/services/hook.lifecycle-registration.service.ts
- core/hookbus/services/hook.decorator-explorer.service.ts
- core/hookbus/interceptors/hook-lifecycle.interceptor.ts
- core/hookbus/hookbus.module.ts
- core/hookbus/cache/hook.cache.ts

函数清单（Function Index）
- HookRegistryService.register(name, handler, metadata)
- HookRegistryService.get(name)
- HookRegistryService.list()
- HookInvokerService.invoke(event, regs)
- HookInvokerService.use(mw)
- HookInvokerService.useNamed(name, mw)
- HookBusService.register(name, handler, metadata)
- HookBusService.emit(event)  -- 注入 ts/callSite, 透传 context
- HookBusService.select(name, filter)
- HookBusService.listRegistrations()
- HookBusService.onDebug(listener)
- HookAuthMiddlewareService.onModuleInit()  -- 注册全局 auth mw, 解析 token → principalId
- HookLifecycleRegistrationService.onModuleInit()  -- 把 @HookLifecycle 声明的 input zod schema 包成 envelope schema 写入 metadata.payloadSchema; 同时反射读 @CheckAbility 自动继承到 metadata.requiredAbility
- HookLifecycleRegistrationService.resolveTarget(className, methodName)  -- 一次扫描同时取 callable + @CheckAbility 元数据
- HookLifecycleInterceptor.intercept(context, next)  -- 把 token / principalId 写入 event.context
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
Hook鉴权中间件 -> core/hookbus/services/hook.auth-middleware.service.ts
Hook生命周期注册服务 -> core/hookbus/services/hook.lifecycle-registration.service.ts
Hook装饰器扫描 -> core/hookbus/services/hook.decorator-explorer.service.ts
Hook生命周期拦截器 -> core/hookbus/interceptors/hook-lifecycle.interceptor.ts
HookBus模块 -> core/hookbus/hookbus.module.ts
Hook缓存服务 -> core/hookbus/cache/hook.cache.ts

类型导出（Types）
- HookEvent<T>           -- name + payload + context + filter + declaration + callSite + log
- HookInvocationContext  -- token / principalId / principalType / source / traceId / runnerId / ts / extras
                            extras.debug=true 触发 OTel sandbox tracer (call-hook.tools.ts 透传 input.debug 进来)
- HookHandler<T,R>       -- (event) => HookResult, 与 Runner 同形
- HookMiddleware<T,R>    -- (event, next) => HookResult, 与 Runner 同形
- HookRequiredAbility    -- { action, subject }; 与 identity RequiredAbility 同构, 不反向 import
- HookLog                -- handler 可见的日志接口: trace/debug/info/warn/error/event(name, attrs?)
                            invoker 注入到 event.log; 实现见 core/observability/services/hook-log.factory.ts
- HookLogEntry           -- drain 出来的单条 { ts, level, message, attrs? }; 写到 HookResult.debugLog
- HookLogSession         -- { log, finalize({ ok?, error? }) => HookLogEntry[] }
- HookRegistration / HookMetadata / HookResult / HookFilter / HookDeclaration
                            HookResult.debugLog?: HookLogEntry[]; debug=true 时由 invoker drain 注入

快速检索映射（Keywords -> Files）
- "hook.bus.service" / "HookBusService" -> src/core/hookbus/services/hook.bus.service.ts
- "hook.invoker.service" / "HookInvokerService" -> src/core/hookbus/services/hook.invoker.service.ts
- "hook.registry.service" / "HookRegistryService" -> src/core/hookbus/services/hook.registry.service.ts
- "hook.auth-middleware.service" / "HookAuthMiddlewareService" -> src/core/hookbus/services/hook.auth-middleware.service.ts
- "hook.types" / "Hook Types" -> src/core/hookbus/types/hook.types.ts
- "hook.enums" / "Hook Enums" -> src/core/hookbus/enums/hook.enums.ts
- "hook.cache" / "Hook Cache" -> src/core/hookbus/cache/hook.cache.ts

模块功能描述（Description）
HookBus 模块是系统的事件编排核心，支持同名 Hook 的多插件实现与条件筛选、中间件跟踪与安全治理；采用本地队列模式（多进程独立），不做跨进程分发。处理器并行执行以避免慢钩子阻塞；不依赖数据库表，提供状态缓存与生产者-消费者式发布（emit 返回 Promise 结果）。

调用上下文（HookInvocationContext）作为 HookEvent 的独立通道, 与 payload 平行:
- payload 由 LLM / 调用方填业务参数
- context 由调用入口 (HookLifecycleInterceptor / AgentRuntime tool 闭包) 注入 token / principalId / traceId
- HookAuthMiddleware 解析 token, 校验后回填 principalId, handler 通过 event.context 直接读
- LLM tool schema 不暴露 context 字段, LLM 不可见不可改

handler / middleware 签名统一为 `(event, next?) => HookResult`, 与 Runner 端完全一致, 没有 ctx wrapper。

权限校验 (与 HTTP @CheckAbility 对齐):
- HookMetadata.requiredAbility = { action, subject } 或数组 (AND); HookHandler 注册可显式写,
  HookLifecycle 注册时由 lifecycle-registration 反射读同方法 @CheckAbility 自动继承
- HookInvokerService.invoke 在派发前把 reg.metadata.requiredAbility 镜像到 event.declaration.requiredAbility,
  让中间件无需访问 reg 即可读到 (中间件签名只接受 event)
- 校验由 identity 模块的 HookAbilityMiddlewareService 注入 invoker.use, 仅当 context.source === 'llm'
  时才校验, 其他来源 (http/system/runner-internal) 走各自入口卫兵, 避免双重校验
- 校验失败软返 errorMsg `permission-denied:<action>:<subject>`, 与 hook 调用统一软错语义保持一致

日志通道 (event.log, OTel-backed, debug 开关):
- HookEvent.log 是 HookLog 接口, 由 HookInvokerService 在每次命中 reg 派发前注入, 不会为 undefined
- debug=false (默认): 单例 NOOP_HOOK_LOG, 全部方法 no-op, 零开销; HookResult.debugLog 缺省
- debug=true: invoker 为该次调用造一次性 BasicTracerProvider + InMemorySpanExporter, log.* → SpanEvent;
  handler 完成后 invoker.finalize() 同步 end span + 投影 SpanEvent 为 HookLogEntry[] 写到 result.debugLog,
  再异步 shutdown provider; 多个命中 reg 各自独立 session, 并发互不污染
- debug 信号: event.context.extras.debug === true (call-hook.tools.ts dispatchSaasHook 把 input.debug 写在这里)
- LLM 拿到的回包 reply.debugLog 是所有命中 reg.debugLog 的拍平合并, 失败/成功都写
- CLAUDE.md 强约束: handler 禁 console.log / 独立 LogRecord, 一律走 event.log

payload schema 校验 (zod, SSOT, 全项目唯一校验路径):
- @HookHandler 注册: metadata.payloadSchema 直接写 zod schema
- @HookLifecycle 注册: options.payloadSchema 是 input 部分形状, lifecycle-registration 自动包成
  envelope `{ input, meta?, ok?, result?, error? }` 写入 metadata.payloadSchema
- HookInvokerService.runHandlerWithSchema 在 handler 执行前自动 safeParse, 校验失败返回
  `payload-schema-invalid: <field>: <message>`, 不进入 handler
- handler 签名复用 `HookEvent<z.infer<typeof xxxSchema>>`, schema 即类型源
- 缺省 payloadSchema 时跳过校验 (兼容存量); LLM 通过 get_hook_info 拿到的 JSON Schema 也来自此字段
- 不再使用 class-validator + payloadDto 路径 (已移除)
