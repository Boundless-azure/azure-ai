模块名称：core/observability（可观测性模块）

概述
- 给 hook 调用提供统一的 log 接口 (event.log), 替代 console.log。
- debug=false 走 noop, 零开销; debug=true 起一次性 OTel BasicTracerProvider + InMemorySpanExporter,
  drain 出 SpanEvent 列表写到 reply.debugLog 回 LLM / SaaS。
- CLAUDE.md 强约束: 禁止 console.log, 禁独立 LogRecord, 一律走这套 API。

文件清单（File List）
- core/observability/services/hook-log.factory.ts

类型 SSOT（Type SSOT）
- HookLog / HookLogEntry / HookLogSession 三个类型由 core/hookbus/types/hook.types.ts 托管,
  本模块只是 OTel 后端实现, factory.import type 自 hookbus types 保持单一来源。

函数清单（Function Index）
- createHookLogSession(opts) -- 为一次 hook 调用造 log 会话; debug=false 返 NOOP_SESSION
- NOOP_HOOK_LOG -- 共享 noop log 单例, 用于无 debug 路径下保持 event.log 永远非空

关键词索引（中文 / English Keyword Index）
HookLog工厂 -> core/observability/services/hook-log.factory.ts
HookLog会话 -> core/observability/services/hook-log.factory.ts
NoopLog -> core/observability/services/hook-log.factory.ts
hook-log-factory -> core/observability/services/hook-log.factory.ts
otel-wrapper -> core/observability/services/hook-log.factory.ts
isolated-provider -> core/observability/services/hook-log.factory.ts
memory-exporter -> core/observability/services/hook-log.factory.ts
debug-toggle -> core/observability/services/hook-log.factory.ts
create-hook-log-session -> core/observability/services/hook-log.factory.ts

类型导出（Types）
- HookLog          -- handler 可见: trace/debug/info/warn/error/event(name, attrs?)
- HookLogEntry     -- drain 出来的单条 { ts, level, message, attrs? }
- HookLogSession   -- { log, finalize({ ok?, error? }) => HookLogEntry[] }

模块功能描述（Description）
为 hook 调用提供轻量、隔离、可关停的日志通道:
- 单次调用 = 单 BasicTracerProvider + 单 InMemorySpanExporter, 并发不互相污染
- log.* 全部映射成 SpanEvent.addEvent(name, { 'log.level', ...attrs })
- attrs 走浅 stringify 兜底 (OTel 不接受嵌套对象)
- finalize 内同步 end span + getFinishedSpans + 异步 shutdown provider, 把 SpanEvent 投影回 HookLogEntry
- 不注册全局 tracer, 不污染 ContextManager; 不跨进程传播
