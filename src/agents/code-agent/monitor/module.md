# 模块名称 (Module Name)

code-agent 运行监听埋点 (code-agent/monitor)

## 概述 (Overview)

给 code-agent 的 code graph 运行加**实时可观测埋点**, 供监听页看"每层节点在做什么、每次 LLM 调用进出了什么"。两条产出通道汇到一个进程级 sink (`publishCodeGraphProgress`), 由 `src/app/code-graph-monitor` 的 Nest service 注册实现 (环形缓冲 + WebSocket 推送):
1. **节点事件** —— `nodes/dependency-check-log.ts` 的 `graphLog.append` 每写一条 `code_graph_log` 就顺带 publish 一条 `kind:'node'` 进度 (需 context 里有 session_id 才有归属)。
2. **LLM 事件** —— `instrumentAiServerForMonitor` 在建图时包一层 aiAdapter, 每次节点 `chat` 都 publish `kind:'llm'` 的 start/done/error (含 prompt/response 全文、来源/模型/耗时/工具调用数), 一次插桩覆盖全部节点, 不改调用处。

sink 未注册时全部 no-op; sink 故障绝不拖垮 code graph 主流程。归属键 sessionId (web 天然知道的会话键) + 可选 threadId/runnerId。

## 文件清单 (File List)

- `code-graph-progress.sink.ts` — 进程级进度 sink: 可注册回调 + publish + 事件类型 (node/llm)。解耦, 不依赖 Nest/Redis/Socket.IO。
- `code-graph-ai-instrument.ts` — 把 AgentAiServer 包一层, 每次 useModel/withModel→chat 产出 LLM 监听事件 (prompt/response 全文)。

## 函数清单 (Function List)

- `setCodeGraphProgressSink(sink)` — 注册/摘除真实进度 sink (Redis+WS); 保持 sink 挂点与 graph 逻辑解耦 | keywords: register-progress-sink, monitor
- `publishCodeGraphProgress(msg)` — 发布一条进度到已注册 sink; best-effort, 无 sink 时 no-op, sink 故障不抛 | keywords: publish-progress, monitor
- `instrumentAiServerForMonitor(aiAdapter, keys)` — 给 code-agent aiAdapter 插桩 (sessionId 建图时烘焙); 每层 chat 内部改走 **chatStream** 边流边发 (start→delta/tool_start/tool_end→done), 返回最终结果、节点 API 不变 | keywords: ai-instrument, llm-stream
- `monitorChat(req, {chat, stream})` — **通用** chat 监听: 被监听 (req.sessionId) 走 stream 边流边发, 否则走原 chat 行为不变; 接在 agent-runtime 中央适配器上覆盖全部 agent | keywords: universal-chat-monitor, monitor
- `streamAndMonitor(streamFactory, req, keys)` — 消费 chatStream, 攒批发 delta + tool_start/tool_end 事件, 返回流的最终 AIModelResponse | keywords: stream-and-monitor, llm-stream
- `publishLlm(keys, entry)` — 发一条 LLM 监听事件 (补 ts/归属键) | keywords: publish-progress, monitor
- `nodeFromSource(source)` — 从 chat source ('code-agent.change-plan') 推导节点名 ('change-plan') | keywords: source-to-node, monitor
- `serializePrompt(req)` — systemPrompt + messages 拼成完整提示 (截断) | keywords: prompt-serialize, monitor
- `serializeResponse(res)` — 正文 + 工具调用摘要拼成完整输出 (截断) | keywords: response-serialize, monitor

## 关键词索引 (Keyword Index)

| 中文关键词 | English Keyword |
|---|---|
| 注册进度sink | register-progress-sink |
| 发布进度 | publish-progress |
| 监听 | monitor |
| AI适配器插桩 | ai-instrument |
| LLM监听 | llm-monitor |
| 来源推导节点 | source-to-node |
| 提示序列化 | prompt-serialize |
| 输出序列化 | response-serialize |
| LLM调用事件 | llm-call-event |
| 进度条目 | progress-entry |
| 进度推送 | progress-message |

## 类型导出 (Type Exports)

- `CodeGraphLlmEvent` — 一次 LLM 调用事件 `{ callId, node, source, phase, model?, durationMs?, prompt?, response?, toolCalls?, error? }` | keywords: llm-call-event, monitor
- `CodeGraphProgressEntry` — 统一进度条目: `{kind:'node'} & CodeGraphLogEntry` 或 `{kind:'llm'} & CodeGraphLlmEvent` | keywords: progress-entry, monitor
- `CodeGraphProgressMessage` — 一条推送 `{ sessionId, threadId?, runnerId?, entry }` | keywords: progress-message, monitor

## 模块功能描述 (Module Function Description)

- 埋点接入点: `createCodeGraphNodeLogger` (dependency-check-log.ts) 的 `append` 内 publish node 事件; `agent.handle.ts` 的 `launchCodeGenGraphInBackground` 用 `instrumentAiServerForMonitor` 包 aiAdapter 后再交给图。
- 消费方: `src/app/code-graph-monitor/services/code-graph-monitor.service.ts` 在 `onModuleInit` 调 `setCodeGraphProgressSink` 接管, 落环形缓冲并经 `/code-graph` 网关推给 web 监听页。
