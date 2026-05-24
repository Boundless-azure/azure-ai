模块名称：runner/modules/observability（Runner 可观测性模块）

概述
- 给 Runner 端 hook 调用提供与 SaaS 同构的 log 接口 (event.log)。
- envelope.debug=false 走 noop, 零开销。
- envelope.debug=true 起一次性 OTel BasicTracerProvider + InMemorySpanExporter,
  drain 出 SpanEvent 列表写到 hook:result.debugLog 回 SaaS / LLM。
- CLAUDE.md 强约束: 禁止 console.log, 禁独立 LogRecord, 一律走这套 API。

文件清单（File List）
- modules/observability/hook-log.factory.ts

类型 SSOT（Type SSOT）
- HookLog / HookLogEntry / HookLogSession 三个类型由 modules/hookbus/types/hook.types.ts 托管,
  本模块只是 OTel 后端实现, factory.import type 自 hookbus types 保持单一来源。

函数清单（Function Index）
- createHookLogSession(opts) -- 为一次 hook 调用造 log 会话; debug=false 返 NOOP_SESSION
- NOOP_HOOK_LOG -- 共享 noop log 单例

关键词索引（中文 / English Keyword Index）
HookLog工厂Runner -> modules/observability/hook-log.factory.ts
HookLog会话 -> modules/observability/hook-log.factory.ts
NoopLog -> modules/observability/hook-log.factory.ts
hook-log-factory-runner -> modules/observability/hook-log.factory.ts
otel-wrapper -> modules/observability/hook-log.factory.ts
isolated-provider -> modules/observability/hook-log.factory.ts
memory-exporter -> modules/observability/hook-log.factory.ts
debug-toggle -> modules/observability/hook-log.factory.ts
create-hook-log-session -> modules/observability/hook-log.factory.ts

模块功能描述（Description）
为 hook 调用提供轻量、隔离、可关停的日志通道:
- 单次调用 = 单 BasicTracerProvider + 单 InMemorySpanExporter, 并发不互相污染
- log.* 全部映射成 SpanEvent.addEvent(name, { 'log.level', ...attrs })
- attrs 走浅 stringify 兜底 (OTel 不接受嵌套对象)
- finalize 内同步 end span + getFinishedSpans + 异步 shutdown provider, 把 SpanEvent 投影回 HookLogEntry
- 不注册全局 tracer, 不污染 ContextManager; 不跨进程传播
- envelope.debug 由 hook-rpc.client.ts 解析后透传到 hookbus.emit, hookbus 创建 session 注入 event.log
