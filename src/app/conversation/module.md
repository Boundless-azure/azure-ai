模块名称：app/conversation（对话模块）

目标
- 提供标准与流式（SSE 风格）AI 对话接口：
  - POST /conversation/chat（支持流式，返回 data: <json>\n\n 分片）
  - POST /conversation/sessions（创建新会话）
 - GET  /conversation/sessions/:sessionId/history（会话历史）
 - GET  /conversation/checkpoints/:threadId（检查点列表）
  - GET  /conversation/checkpoints/:threadId/:checkpointId（检查点详情/历史片段）
  - 对话组接口：……
- WebMCP Socket.IO 端点（namespace: /webmcp）：
  - 鉴权：handshake.auth.token + handshake.auth.sessionId
  - 事件：webmcp:register（前端注册 Schema）→ 存 chat_sessions_data
  - 事件：webmcp:call（后端→前端，下发 data/emit 调用）

新增服务/文件
- controllers/webmcp.gateway.ts：WebMCP Socket.IO 网关（namespace /webmcp）
- services/webmcp-session-data.service.ts：会话扩展数据 CRUD
- services/webmcp.hook-handlers.service.ts：WebMCP Hook 处理器
- services/send-msg.hook-handler.service.ts：IM saas.app.conversation.sendMsg Hook 处理器（主动对话模式）

Hook 注册（由 HookDecoratorExplorerService 自动发现, 全部声明 payloadSchema 以走 invoker 自动校验, 命名遵循 platform.app.module.action）
- saas.app.conversation.webControl         — 向前端发送 data/emit 调用 (sessionId / type / payload / timeout?)
- saas.app.conversation.webControlPageinfo — 获取最新注册页面信息 Schema (sessionId)
- saas.app.conversation.webControlData    — 请求前端实时返回指定 data key 值 (sessionId / dataKey)
- saas.app.conversation.webControlStatus  — 查询 MCP 连接状态 (sessionId)
- saas.app.conversation.sendMsg           — 主动对话: LLM 通过 call_hook('saas.app.conversation.sendMsg') 发消息 (sessionId / content / senderPrincipalId / replyToId)
  · payload schema 走 zod, handler 签名通过 z.infer 复用类型 (SSOT)
- saas.app.conversation.sessionData.save   — AI 自管 session_data: 写入/覆盖跨轮键值 (sessionId / key / value / **title 必填且必须描述性强, ≥8 字符**)
- saas.app.conversation.sessionData.get    — 读单条完整 value (sessionId / key)
- saas.app.conversation.sessionData.list   — 列出本会话所有记忆的轻量元数据 (sessionId), 返回 { count, listing }; listing 是分行 markdown 文本 (每行 `- \`key\` :: title  (MM-DD, NB)`), **不含 value**, 凭 title 命中后调 get 取完整内容
- saas.app.conversation.sessionData.delete — 软删单条 (sessionId / key)
  · ⚠ 不再注入 systemPrompt :: 早期版本拼到 systemPrompt 中段, LLM 注意力衰减用不起来, 已废弃
  · ✅ 改为 messages 流注入 :: AgentRuntimeService.startDialogue → enrichWithSessionRecall 在每轮 LLM 请求前主动 hookBus.emit 调 sessionData.list (source: 'system' 绕权), 把 listing 包在 `[session-data-recall]…[/session-data-recall]` 标签内作为 system message 追加到 messages 数组**末尾** (紧贴 user 最新消息, 注意力强); LLM 不再需要主动 list
  · ⚠ list 不返 value/preview :: 后期记忆量上来 list 输出仍可控; 命中后调 get 拿完整 value; **这要求 title 必须写得足够描述性, 否则 list 视图无效**
  · key 字符集 `[a-zA-Z0-9_.-]` 1-128 字符; 上限 单 key 10KB, 总量 200KB, 50 个 key
    - GET  /conversation/groups（分页：page/pageSize；每组附带 latestMessage；不支持日期筛选）
    - GET  /conversation/groups/:groupId（组详情）
    - POST /conversation/groups（创建组，入参：date 或 dayGroupId）
    - PUT  /conversation/groups/:groupId（更新标题/active/chatClientId）
    - DELETE /conversation/groups/:groupId（软删除）
    - GET  /conversation/groups/:groupId/summaries（根据组ID获取阶段性总结）
    - GET  /conversation/groups/:groupId/history（根据组ID获取最近窗口历史，支持 includeSystem/limit）
  - 线程消息接口：
    - POST /conversation/threads/:threadId/messages（在线程内发送用户消息，自动复用或创建会话并绑定到该组）

文件结构
- controllers/conversation.controller.ts：对外 REST 接口（标准/流式）
- services/conversation.service.ts：对话业务逻辑、AI 调用、function-call 执行
- types/conversation.types.ts：类型声明与运行时守卫（type guards）
- module.tip：模块说明与规范

类型与守卫（types/conversation.types.ts）
- 类型：
  - ChatRequest / ChatResponse / StreamChunk
  - CreateSessionRequest / CreateSessionResponse
  - GetHistoryRequest / GetHistoryResponse
  - MessageMetadata / FunctionCall / AIModelResponseWithFunctionCalls
- 守卫：
  - isObject / isStringArray
  - isOrchestratorParams（phase/modelId/input 校验；generate 阶段要求 plan）
  - isMysqlSelectArgs（sql:string, limit:number, params?:array）
  - isKeywordWindowArgs（keywords:string[], limit:number, includeSystem?:boolean, matchMode?:'any'|'all'）

流式传输规范（SSE 风格）
- 响应头：
  - Content-Type: text/event-stream（建议；当前实现为 text/stream 也可解析）
  - Cache-Control: no-cache
  - Connection: keep-alive
  - Access-Control-Allow-Origin: *
- 数据格式：按行输出 "data: {json}\n\n"
  - 正常分片：{ type: 'content', content, sessionId }
  - 完成标记：{ type: 'done', sessionId }
  - 错误分片：{ type: 'error', error }
- 前端读取：
  - fetch + ReadableStream 逐块解析（POST 接口）
  - 或新增 GET 接口并使用 EventSource（SSE 标准方案）

WebSocket 接口说明
- 已移除 `/conversation/ws`（过期的 AI 对话 Socket.io 流式网关）。
- AI 流式能力使用 SSE（`GET /conversation/chat/stream`）或非流式 REST（`POST /conversation/chat`）。

Checkpoint 历史接口
 - GET `/conversation/checkpoints/:threadId`
  - 入参：`threadId`（等同于对话组ID `conversationGroupId`）；`limit?`（默认50）
  - 出参：`{ threadId, items: [{ checkpointId, ts, metadata? }] }`
- GET `/conversation/checkpoints/:threadId/:checkpointId`
  - 入参：`threadId`（对话组ID）、`checkpointId`
  - 出参：
    - `checkpoint`：`{ id, ts }`
    - `metadata?`：记录的附加元信息
    - `writes`：`[{ taskId, channel, value }]`（原始写入）
    - `history`：从 writes 推导的片段 `[{ role, content, channel? }]`
  - 说明：`history` 为便于前端直读的片段集合；完整上下文可调用 `/conversation/sessions/:sessionId/history`。

Summary 接口
- GET `/conversation/groups/:groupId/summaries`
  - 入参：`groupId`（对话组ID）；`limit?`（默认100）
  - 出参：`{ groupId, items: [{ sessionId, roundNumber, summaryContent, createdAt }] }`
  - 说明：聚合该分组下所有会话的阶段性摘要（默认每 20 轮一条），倒序返回；前端可用于时间线或概览面板。

注释规范
- 源码中对外接口/类型/守卫函数均使用 JSDoc 描述用途与关键校验点
- 对因 ESLint 类型服务误判的成员访问，使用行内精准关闭注释：
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  仅对具体行生效，避免影响其他规则与文件

#problems_and_diagnostics
诊断清单（Checklist）
- [x] 类型与守卫集中到 types 目录并加注释
- [x] controller/service 引用统一使用路径别名（@ / @core）
- [x] 流式响应按 SSE 语法输出 data: {json}\n\n

常见问题与处理
- [warning] 前端无法用 EventSource 消费 POST 流
  - 处理：使用 fetch 读取 ReadableStream，或新增 GET 流式接口
- [info] ESLint 对成员访问误判为 error typed value
  - 处理：保持 tsc 通过后，针对具体行添加精准关闭注释
- [info] 相对路径在目录迁移后断裂
  - 处理：统一使用路径别名 @ / @core 引入

# 关键词与文件对照（Keywords ↔ Files）
- 中文关键词 ↔ 英文关键词 ↔ 文件名
- 对话组列表 ↔ conversation-group list ↔ controllers/conversation-group.controller.ts
- 最新消息 ↔ latest message ↔ controllers/conversation-group.controller.ts
- 分页 ↔ pagination ↔ controllers/conversation-group.controller.ts
- 对话历史 ↔ conversation history ↔ controllers/conversation-group.controller.ts
- 对话服务 ↔ conversation service ↔ services/conversation.service.ts
- 类型与守卫 ↔ types and guards ↔ types/conversation.types.ts
- IM 消息历史 ↔ im message history ↔ controllers/im.controller.ts
- IM 新消息探测 ↔ im has-new probe ↔ controllers/im.controller.ts
- IM 邀请成员 ↔ im invite members ↔ controllers/im.controller.ts
- IM 会话更新 ↔ im session update ↔ controllers/im.controller.ts
- IM 退出群聊 ↔ im leave group ↔ controllers/im.controller.ts
- IM 踢人 ↔ im kick member ↔ controllers/im.controller.ts
- IM 转让群主 ↔ im transfer owner ↔ controllers/im.controller.ts
- IM 群公告 ↔ im announcements ↔ controllers/im.controller.ts
- IM 私聊拉群 ↔ im dm to group ↔ services/im-session.service.ts
- IM 系统消息 ↔ im system message ↔ services/im-message.service.ts
- IM 通讯录分组 ↔ im contact groups ↔ controllers/im-contact-group.controller.ts
- IM 分组成员维护 ↔ im contact group members ↔ services/im-contact-group.service.ts

# 关键词到文件函数哈希映射（Keywords -> Function Hash）
- ConversationGroupController.listGroups -> 98f1c2a7
- ConversationGroupController.listGroupHistory -> 3b7d5e21
- ConversationService.chat -> 5c2ea110
- ConversationService.chatStream -> a8d44c6f
- ConversationService.getSessionHistory -> 1d9b7e02
- ImMessageService.getMessages -> im_msg_get_001
- ImMessageService.hasNew -> im_msg_has_new_002
- ImController.inviteMembers -> im_ctl_invite_003
- ImSessionService.inviteMembers -> im_sess_invite_004
- ImController.updateSession -> im_ctl_update_session_005
- ImSessionService.updateSession -> im_sess_update_session_006
- ImController.leaveSession -> im_ctl_leave_session_007
- ImSessionService.leaveSession -> im_sess_leave_session_008
- ImController.removeMember -> im_ctl_kick_009
- ImSessionService.kickMember -> im_sess_kick_010
- ImController.transferOwner -> im_ctl_transfer_owner_011
- ImSessionService.transferOwner -> im_sess_transfer_owner_012
- ImController.getAnnouncements -> im_ctl_announce_list_013
- ImMessageService.getAnnouncements -> im_msg_announce_list_014
- ImController.createAnnouncement -> im_ctl_announce_create_015
- ImMessageService.sendAnnouncement -> im_msg_announce_create_016
- ImController.deleteAnnouncement -> im_ctl_announce_unset_017
- ImMessageService.unsetAnnouncement -> im_msg_announce_unset_018
- ImContactGroupController.list -> im_cg_list_019
- ImContactGroupController.create -> im_cg_create_020
- ImContactGroupController.update -> im_cg_update_021
- ImContactGroupController.delete -> im_cg_delete_022
- ImContactGroupController.listMembers -> im_cg_members_list_023
- ImContactGroupController.addMembers -> im_cg_members_add_024
- ImContactGroupController.removeMember -> im_cg_members_remove_025
- ImContactGroupService.listGroups -> im_cg_svc_list_026
- ImContactGroupService.addMembers -> im_cg_svc_add_027

备注
- 本文件仅用于目录与规范说明，便于 IDE 与开发者快速了解模块结构；不参与构建。
