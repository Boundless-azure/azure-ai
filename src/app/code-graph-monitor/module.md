# 模块名称 (Module Name)

Code Graph 监听模块 (code-graph-monitor)

## 概述 (Overview)

code-agent 运行监听的**后端枢纽**: 把 `src/agents/code-agent/monitor` 埋点产出的进度事件 (节点日志 + LLM 调用) 收进进程内环形缓冲, 并经 `/code-graph` WebSocket 网关实时推给前端监听页。service 在启动时把自己注册成全局进度 sink; gateway 单向依赖 service (拿 backfill + 订阅事件), 避免循环依赖。归属键是 sessionId (web 天然知道的会话键)。单实例内存态, 跨实例 HA 回放留后续 (可换 Redis pub/sub + list)。

## 文件清单 (File List)

- `services/code-graph-monitor.service.ts` — 进度枢纽: 注册全局 sink、按 sessionId 环形缓冲 (会话数+条数双上限)、广播给订阅者、供 backfill。
- `controllers/code-graph-monitor.gateway.ts` — `/code-graph` Socket.IO 网关: token 鉴权、按 sessionId 加入房间 (加入即 backfill)、实时广播 `code-graph:event`。
- `code-graph-monitor.module.ts` — 装配 (imports AuthModule; providers service+gateway)。

## 函数清单 (Function List)

- `CodeGraphMonitorService.onModuleInit()` — 启动时注册自己为全局进度 sink | keywords: register-sink, monitor-service
- `CodeGraphMonitorService.onModuleDestroy()` — 卸载时摘除 sink | keywords: detach-sink, monitor-service
- `CodeGraphMonitorService.ingest(msg)` — 收进度: 追加环形缓冲 (裁旧+逐出最早会话) 再广播 | keywords: ingest-progress, ring-buffer
- `CodeGraphMonitorService.getBackfill(sessionId)` — 读某会话已缓冲全部进度 (连接回放) | keywords: backfill-buffer, monitor-service
- `CodeGraphMonitorService.onProgress(listener)` — 订阅实时进度, 回取消函数 | keywords: subscribe-progress, monitor-service
- `CodeGraphMonitorService.emit(msg)` — 手动注入一条进度 (测试/外部源) | keywords: emit-progress, monitor-service
- `CodeGraphMonitorGateway.onModuleInit()` — 订阅 service 进度并广播到 session 房间 | keywords: subscribe-broadcast, monitor-gateway
- `CodeGraphMonitorGateway.handleConnection(client)` — 连接鉴权 (auth.token / Bearer → verifyToken → principalId) | keywords: connect-auth, monitor-gateway
- `CodeGraphMonitorGateway.onJoin(dto, client)` — `code-graph/join`: 加入 session 房间 + 回放 backfill | keywords: join-backfill, monitor-gateway
- `CodeGraphMonitorGateway.onLeave(dto, client)` — `code-graph/leave`: 离开房间 | keywords: leave-room, monitor-gateway

## 关键词索引 (Keyword Index)

| 中文关键词 | English Keyword |
|---|---|
| 监听服务 | monitor-service |
| 监听网关 | monitor-gateway |
| 注册sink | register-sink |
| 摘除sink | detach-sink |
| 收进度 | ingest-progress |
| 环形缓冲 | ring-buffer |
| 回放缓冲 | backfill-buffer |
| 订阅进度 | subscribe-progress |
| 注入进度 | emit-progress |
| 订阅广播 | subscribe-broadcast |
| 连接鉴权 | connect-auth |
| 加入回放 | join-backfill |
| 离开房间 | leave-room |
| 实时推送 | realtime-push |
| 装配 | wiring |

## 模块功能描述 (Module Function Description)

- WS 事件: 客户端连 `/code-graph` (path `/api/socket.io`, auth `{token}`) → emit `code-graph/join {sessionId}` → 收 backfill + 实时 `code-graph:event` (载荷 = `CodeGraphProgressMessage`)。
- 鉴权: `AuthService.verifyToken` 校验 token 拿 principalId; 缺/错 token 发 `code-graph:error`。(会话成员校验为后续加固点。)
- 上游: 事件来自 `src/agents/code-agent/monitor` 的 `publishCodeGraphProgress`; 本模块 service `onModuleInit` 用 `setCodeGraphProgressSink` 接管。
- 在 `app.module.ts` 的 imports 里紧随 `ConversationModule` 注册。
