# API 文档：对话组与流式对话接口

本文档汇总以下接口的 DTO、请求方法与返回结构：
- 对话组接口增删改查
- 对话组提要（summary_table）接口
- WebSocket 流式对话接口（详细返回说明）

所有路径均以后端服务根路径为基准，例如 `http://<host>/`。

## 对话组接口增删改查

- 列表
  - 方法与路径：`GET /conversation/groups`
  - 查询参数：
    - `date?: string` (YYYY-MM-DD)
    - `dayGroupId?: string`
  - 返回：`GroupListItem[]`

```ts
// Query
export interface GroupListQueryDto {
  date?: string;
  dayGroupId?: string;
}

// Item
export interface GroupListItem {
  id: string;
  dayGroupId: string;
  title: string | null;
  chatClientId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
```

- 详情
  - 方法与路径：`GET /conversation/groups/:groupId`
  - 返回：`GroupDetailResponse`

```ts
export interface GroupDetailResponse {
  id: string;
  dayGroupId: string;
  title: string | null;
  chatClientId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  sessionCount: number;
}
```

- 创建
  - 方法与路径：`POST /conversation/groups`
  - 请求体：`CreateGroupRequest`
  - 返回：`CreateGroupResponse`

```ts
export interface CreateGroupRequest {
  date?: string;
  dayGroupId?: string;
  title?: string | null;
  chatClientId?: string | null;
}

export interface CreateGroupResponse {
  id: string;
  dayGroupId: string;
}
```

- 更新
  - 方法与路径：`PUT /conversation/groups/:groupId`
  - 请求体：`UpdateGroupRequest`
  - 返回：`{ success: true }`

```ts
export interface UpdateGroupRequest {
  title?: string | null;
  active?: boolean;
  chatClientId?: string | null;
}

export interface UpdateGroupResponse {
  success: true;
}
```

- 删除（软删除）
  - 方法与路径：`DELETE /conversation/groups/:groupId`
  - 返回：`{ success: true }`

```ts
export interface DeleteGroupResponse {
  success: true;
}
```

### 示例

```http
GET /conversation/groups?date=2025-12-14

200 OK
[
  {
    "id": "e7a...",
    "dayGroupId": "b21...",
    "title": "项目讨论",
    "chatClientId": "web",
    "active": true,
    "createdAt": "2025-12-14T08:01:02.345Z",
    "updatedAt": "2025-12-14T08:10:11.222Z"
  }
]
```

```http
POST /conversation/groups
Content-Type: application/json

{
  "date": "2025-12-14",
  "title": "新会话组",
  "chatClientId": "web"
}

200 OK
{
  "id": "e7a...",
  "dayGroupId": "b21..."
}
```

## 对话组提要接口（summary_table）

- 方法与路径：`GET /conversation/groups/:groupId/summaries`
- 查询参数：
  - `limit?: string`（默认 100）
- 返回：`SummariesByGroupResponse`

```ts
export interface SummaryItem {
  sessionId: string;
  roundNumber: number;
  summaryContent: string;
  createdAt: string;
}

export interface SummariesByGroupResponse {
  groupId: string;
  items: SummaryItem[];
}
```

### 示例

```http
GET /conversation/groups/e7a.../summaries?limit=50

200 OK
{
  "groupId": "e7a...",
  "items": [
    {
      "sessionId": "s-001",
      "roundNumber": 20,
      "summaryContent": "讨论了需求拆分与时间计划",
      "createdAt": "2025-12-14T08:05:00.000Z"
    }
  ]
}
```

## 对话组历史接口

- 方法与路径：`GET /conversation/groups/:groupId/history`
- 查询参数：
  - `limit?: string`（默认 100）
  - `includeSystem?: string`（`true|false`，默认 `true`）
- 返回：`GroupHistoryResponse`

```ts
export interface GroupHistoryItem {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface GroupHistoryResponse {
  groupId: string;
  items: GroupHistoryItem[];
}
```

### 示例

```http
GET /conversation/groups/e7a.../history?limit=50&includeSystem=true

200 OK
{
  "groupId": "e7a...",
  "items": [
    {
      "role": "system",
      "content": "你是一个专业的会议记录助手",
      "timestamp": "2025-12-14T08:00:00.000Z"
    },
    {
      "role": "user",
      "content": "请记录今天会议要点",
      "timestamp": "2025-12-14T08:01:02.345Z",
      "metadata": { "channel": "input" }
    },
    {
      "role": "assistant",
      "content": "今天会议主要围绕如下要点...",
      "timestamp": "2025-12-14T08:02:10.111Z",
      "metadata": { "channel": "model_output" }
    }
  ]
}
```

### 实现说明

- 数据来源：历史记录由后端基于 LangGraph 自定义 Checkpoint 持久化表解析得到，表结构含 `lg_checkpoints` 与 `lg_writes`。
- 解析规则：逐个检查点读取其 `pendingWrites` 三元组 `[taskId, channel, value]`，根据 `channel` 与 `value` 推断角色与文本，形成 `{ role, content, timestamp, metadata }`。
- 系统消息：`includeSystem` 默认为 `true`；当为 `false` 时将过滤掉解析得到的系统类消息。
- 时间戳：`timestamp` 取自检查点的记录时间（简化为 ISO 字符串）。

## WebSocket 流式对话接口

- 连接：`ws://<host>/conversation/ws`
- 客户端事件：`chat_start`
  - 载荷：`ChatRequestDto`

```ts
export interface ChatRequestDto {
  message: string;
  sessionId?: string;
  modelId?: string;
  systemPrompt?: string;
  stream?: boolean;
  date: string;
  chatClientId: string;
}
```

- 服务端事件：统一为 `conversation_event`
- 事件载荷联合类型：

```ts
export type ConversationSseEvent =
  | { type: 'token'; data: { text: string }; sessionId?: string }
  | { type: 'reasoning'; data: { text: string }; sessionId?: string }
  | { type: 'tool_start'; data: { name: string; input?: unknown; id?: string }; sessionId?: string }
  | { type: 'tool_chunk'; data: { id?: string; name?: string; args?: unknown; index?: number }; sessionId?: string }
  | { type: 'tool_end'; data: { name?: string; output?: unknown; id?: string }; sessionId?: string }
  | { type: 'session_group'; data: { sessionGroupId: string; date: string; chatClientId: string }; sessionId?: string }
  | { type: 'session_group_title'; data: { sessionGroupId: string; title: string }; sessionId?: string }
  | { type: 'done'; sessionId?: string }
  | { type: 'error'; error: string; sessionId?: string };
```

### 事件序列与语义说明

- 启动：客户端发送 `chat_start`，载荷为 `ChatRequestDto`
- 服务端响应顺序（典型）：
  - `session_group`：返回 `{ sessionGroupId, date, chatClientId }`，并带 `sessionId`
  - 若启用组标题生成，随后返回 `session_group_title`：`{ sessionGroupId, title }`
  - 若模型为增量输出，逐条返回 `token` 事件：`{ text }`
  - 如模型包含「思维链」类推理内容，则可能返回 `reasoning` 事件
  - 如触发函数/工具调用，返回 `tool_start` / `tool_chunk` / `tool_end`
  - 完成：返回 `done`（附带 `sessionId`）
  - 异常：返回 `error`

### 示例（客户端发起与服务端响应）

```json
// 客户端 -> 服务端
{
  "type": "chat_start",
  "payload": {
    "message": "帮我总结今天的会议要点",
    "date": "2025-12-14",
    "chatClientId": "web"
  }
}
```

```json
// 服务端 -> 客户端（conversation_event）
{ "type": "session_group", "data": { "sessionGroupId": "e7a...", "date": "2025-12-14", "chatClientId": "web" }, "sessionId": "s-001" }
{ "type": "session_group_title", "data": { "sessionGroupId": "e7a...", "title": "会议总结" }, "sessionId": "s-001" }
{ "type": "token", "data": { "text": "今天会议主要讨论了..." }, "sessionId": "s-001" }
{ "type": "done", "sessionId": "s-001" }
```

### 线程标识（thread_id）说明

- 所有聊天请求在后端统一将 AI 调用的 `thread_id` 设为该轮产生的 `conversationGroupId`（对话组ID）。
- 如客户端复用既有 `sessionId`，后端会反查其已绑定的组ID并用于 `thread_id`；若未绑定则回退使用 `sessionId`。

## Checkpoint 接口

- 列表
  - 方法与路径：`GET /conversation/checkpoints/:threadId`
  - 查询参数：`limit?: string`（默认 50）
  - 返回：`CheckpointListResponse`

```ts
export interface CheckpointListItem {
  checkpointId: string;
  ts: string;
  metadata?: Record<string, unknown>;
}

export interface CheckpointListResponse {
  threadId: string;
  items: CheckpointListItem[];
}
```

- 详情
  - 方法与路径：`GET /conversation/checkpoints/:threadId/:checkpointId`
  - 返回：`CheckpointDetailResponse`

```ts
export interface CheckpointDetailResponse {
  threadId: string;
  checkpointId: string;
  checkpoint: { id: string; ts: string };
  metadata?: Record<string, unknown>;
  writes: Array<{ taskId: string; channel: string; value: unknown }>;
  history: Array<{ role: 'system' | 'user' | 'assistant'; content: string; channel?: string }>;
}
```

### 示例

```http
GET /conversation/checkpoints/e7a.../12345

200 OK
{
  "threadId": "e7a...",
  "checkpointId": "12345",
  "checkpoint": { "id": "12345", "ts": "2025-12-14T08:02:10.111Z" },
  "metadata": { "phase": "chat" },
  "writes": [
    { "taskId": "t1", "channel": "input", "value": { "role": "human", "content": "你好" } },
    { "taskId": "t2", "channel": "model_output", "value": { "role": "ai", "content": "你好！" } }
  ],
  "history": [
    { "role": "user", "content": "你好", "channel": "input" },
    { "role": "assistant", "content": "你好！", "channel": "model_output" }
  ]
}
```
