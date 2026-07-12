# 模块名称 (Module Name)

Code Agent 运行监听页 (code-graph-monitor)

## 概述 (Overview)

web 端的 code-agent 运行监听页: 经 saas `/code-graph` WebSocket 实时看一次代码生成运行**每层节点的进度与每次 LLM 调用**。左侧按 code graph 固定 10 节点拓扑显示状态 (待/跑/成/错) + 日志数 + LLM 数, 右侧展开选中节点的日志时间线与每次 LLM 调用 (可展开看 prompt/response 全文)。按 sessionId 订阅 (默认取当前会话 `agentStore.currentSessionId`, 可手填)。作为右侧面板一个 tab (`codeGraphMonitor`), 侧边栏入口 `diagram-project` 图标。

## 文件清单 (File List)

- `types/code-graph-monitor.types.ts` — 进度事件形状 (node/llm, 镜像后端) + `CODE_GRAPH_NODES` 拓扑 + 节点状态枚举。
- `services/code-graph-monitor.socket.ts` — `/code-graph` WebSocket 客户端: 连接/鉴权/join sessionId/收 `code-graph:event`。
- `components/CodeGraphMonitor.vue` — 监听页: 节点拓扑 + 节点日志/LLM 调用明细 + prompt/response 展开。

## 函数清单 (Function List)

- `CodeGraphMonitorSocket.connect(sessionId, token, callbacks)` — 连 `/code-graph`、join 会话、订阅进度事件; 重复调用先断旧连接 | keywords: connect-subscribe, monitor-client
- `CodeGraphMonitorSocket.disconnect()` — 断开并清理监听器 | keywords: disconnect-cleanup, monitor-client
- `baseWsUrl()` — 解析 WS 基址 (PUBLIC_WS_BASE_URL 或当前 origin) | keywords: ws-base-url, monitor-client
- `CodeGraphMonitor.setup` — 组件逻辑: 连接控制、按 node 分组日志/LLM、节点状态推导、prompt/response 展开 | keywords: monitor-page, realtime-progress

## 关键词索引 (Keyword Index)

| 中文关键词 | English Keyword |
|---|---|
| 监听页 | monitor-page |
| 监听客户端 | monitor-client |
| 连接订阅 | connect-subscribe |
| 断开清理 | disconnect-cleanup |
| WS基址 | ws-base-url |
| 实时进度 | realtime-progress |
| LLM调用 | llm-call |
| 节点拓扑 | node-topology |
| 进度事件 | progress-event |

## 类型导出 (Type Exports)

- `CodeGraphProgressMessage` / `CodeGraphProgressEntry` / `CodeGraphNodeEntry` / `CodeGraphLlmEntry` — 进度事件形状 (镜像后端 sink) | keywords: progress-event, monitor-types
- `CODE_GRAPH_NODES` — code graph 固定 10 节点顺序 (拓扑渲染) | keywords: node-topology, monitor-types
- `CodeGraphNodeStatus` — 节点状态 `pending|active|done|error` | keywords: node-topology, monitor-types

## 模块功能描述 (Module Function Description)

- 入口: 侧边栏 `codeGraphMonitor` (Sidebar.vue menuItems) → 右侧面板 tab (agent/config/tab.registry.ts) 懒加载 `CodeGraphMonitor.vue`; i18n key `sidebar.codeGraphMonitor` (EN/CN)。
- 连接: `io('<origin>/code-graph', { path:'/api/socket.io', auth:{ token: localStorage.token } })` → emit `code-graph/join {sessionId}` → 收 backfill + 实时 `code-graph:event`。
- 节点状态推导: 有 error 级/含 blocked 的日志或 LLM error → error; 无事件 → pending; 最新事件所在节点 → active; 更靠后节点已有事件 → done。
- LLM 调用按 callId 合并 start(prompt)+done(response)/error, 展开看全文。
