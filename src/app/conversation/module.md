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
- controllers/conversation.controller.ts：Conversation REST + smartTags/smartSearch/smartMessages 分层历史检索 HookRoute
- controllers/im.controller.ts：IM REST + saas.app.conversation.sendMsg HookRoute（主动对话模式）
- controllers/webmcp.gateway.ts：WebMCP Socket.IO 网关（namespace /webmcp）+ WebMCP HookRoute
- services/webmcp-session-data.service.ts：会话扩展数据 CRUD
- services/ai-session-data.service.ts：session_data CRUD + category 派生 (handbook/directive/preference/recipe/legacy/general) + handbook 按 owner 过滤
- controllers/ai-session-data.hook-controller.ts：sessionData.save/get/list/delete HookController, list 按 category 分组渲染
- services/ai-call-log.service.ts：call_hook 调用日志硬记录, FIFO 50 条/session, 仅成功项, FIFO 软删; payload/result 不按大小跳过; 默认查询只返 data-title 轻量列表, 按 id 二次取详情
- controllers/ai-call-log.hook-controller.ts：saas.app.conversation.callHistory.query HookController
- services/current-session.service.ts：currentSession 单进程临时态 + initTip 工具判定 + pendingAction 参数追问挂起 + lazy guard 标签
- controllers/current-session.hook-controller.ts：currentSession.set/get/setPendingAction/clearPendingAction HookController; init_tip 已从 hook 提升为 **top-level tool** (见 core/agent-runtime/tools/init-tip.tool.ts), 不再走 HookController
- services/chat-session-smart.service.ts：chat_session_smart 后台分段写入, 阈值来自 session 内首个 agent.aiModelIds[0] 对应模型的 ai_models.smart_segment_chars 字段 (null/无 agent → 默认 5000); 摘要+关键词优先用 LLM (SmartLlmGeneratorService), 失败回退规则算法 (中文 bigram + 英文词频); 外层套 SessionLockService 按 sessionId 串行, 避免重复压缩 + 对话/压缩读写竞态
- services/session-lock.service.ts：sessionId 级 in-memory promise queue, runExclusive(sessionId, label, fn) 让"smart 压缩 + 各 agent 对话"严格 FIFO 排队, 任务完成后清空 tail 防内存泄漏
- services/smart-llm-generator.service.ts：让指定 modelId 读会话段正文输出严格 JSON `{summary, keywords:{zh,en}}`, 含 parseJsonLoose 兜底 (剥 markdown fence / 找首尾大括号), 任何失败 throw 由调用方回退规则算法
- services/session-handbook-seeder.service.ts：按 agent 角色 seed 必读手册到 handbook.* 槽位 (主体身份过滤靠 ownerPrincipalId)
- services/hook-snapshot.service.ts：Web Component Hook 调用入口, 在 message.metadata.hookSnapshots 做"写一次"cache-aside (首请求即冻结, 命中返冻结快照不再经 HookBus; live/无 messageId/超 8KB 阈值 → 不缓存实时路由); payload 规范化键 fnv1a, 写前再读降低并发双写 | keywords: hook-snapshot, write-once-cache, cache-aside, message-anchored, traceability
- controllers/hook-snapshot.controller.ts：POST /hook-snapshot {hookName, payload, messageId?, live?} → 前端 Web Component ctx.callHook 入口, 取代组件直连 /hook-invoke; 鉴权与 hook-invoke 同款 (全局 JwtAuthGuard + source=http) | keywords: hook-snapshot-endpoint, frontend-component-call, write-once-cache

Hook 注册（由 HookControllerExplorerService 自动发现, 全部通过 `@HookRoute(args)` 声明数组形参 schema, 命名遵循 platform.app.module.action）
- HookController tags 覆盖常用发现入口: conversation / im / message / history / webmcp / session-data / call-log
- saas.app.conversation.webControl         — 向前端发送 data/emit 调用 (sessionId / type / payload / timeout?)
- saas.app.conversation.webControlPageinfo — 获取最新注册页面信息 Schema (sessionId)
- saas.app.conversation.webControlData    — 请求前端实时返回指定 data key 值 (sessionId / dataKey)
- saas.app.conversation.webControlStatus  — 查询 MCP 连接状态 (sessionId)
- saas.app.conversation.sendMsg           — 主动对话: LLM 通过 call_hook 发消息. **sessionId / senderPrincipalId 均 optional, 服务端从 ctx 强制覆盖** :: LLM 链路下 senderPrincipalId 永远等于 ctx.principalId (禁止冒充其他主体), sessionId 永远等于 ctx.extras.sessionId; LLM 填了不一致的值 → log warn 并忽略, payload 字段保留仅供外部 curl 调用; replyToId 由 ctx.extras.triggerMessageId 优先覆盖 (LLM 填错也忽略)
- **附件 LLM 可见性 (toDialogueMessage)** :: 消息有 attachments 时, content 末尾追加 `<im_attachments>` 标签, 暴露 resourceId/name/type/size (不暴露签名 URL); LLM 拿 resourceId 后可直接调 saas.app.storage.createNode 入库, 或调 saas.app.resource.currentSession 查全量会话文件 (含历史); 历史 attachment 无 resourceId 的跳过, 不污染 prompt | keywords: attachments-llm-visible, resource-id, im-attachments-tag, build-attachment-block-for-llm
  · payload schema 走 zod, handler 签名通过 z.infer 复用类型 (SSOT)
- **history 链路引导 (init_tip discoveryChains.history)** :: smart 三步检索现在被 init_tip 显式列为第四条标准链路, LLM 声明 `needHistory:true` 时 tipNote 强调走 smartTags → smartSearch → smartMessages; sessionId 必须显式传 (smart hook 不从 ctx 注入), 通常从 directHooks.currentSession.context 拿 | keywords: history-chain, smart-recall, need-history
- saas.app.conversation.smartTags         — 三步历史检索 ①: 拉取 smart 段 keywords 全景 (sessionId)
- saas.app.conversation.smartSearch       — 三步历史检索 ②: 按 keywords 命中 smart 段 summary (sessionId / keywords / limit?); smart 段由后台按"session 内首个 agent 关联模型的 ai_models.smart_segment_chars"阈值累计可见正文生成 (无 agent/无字段 → 默认 5000)
- saas.app.conversation.smartMessages     — 三步历史检索 ③: 按 smartIds 展开对应全消息 (sessionId / smartIds); 单段按 model.smart_segment_chars 阈值生成, 摘要/关键词优先 LLM 失败回退规则
- saas.app.conversation.sessionData.save   — AI 自管 session_data: 写入/覆盖跨轮键值 (sessionId / key / value / **title 必填且必须描述性强, ≥8 字符**); ownerPrincipalId 自动从 ctx.principalId 取, 落 createdUser; 仅用于 handbook seed、用户明确偏好/约束 (directive/preference) 或显式 recipe
- saas.app.conversation.sessionData.get    — 读单条完整 value (sessionId / key); 返回 { key, title, value, category, updatedAt, ownerPrincipalId }
- saas.app.conversation.sessionData.list   — 列出本会话所有记忆的轻量元数据 (sessionId), 返回 { count, listing }; listing 按 category 分组的分段 markdown (handbook / directive / preference / recipe / legacy / general), **不含 value**, 凭 title 命中后调 get 取完整内容
- saas.app.conversation.sessionData.delete — 软删单条 (sessionId / key)
- saas.app.conversation.callHistory.query  — 查最近 50 条**成功** call_hook 调用日志 (硬记录, 仅成功项, batch 内每 entry 算 1 条, FIFO 软删, payload/result 不按大小跳过); payload: { id?, search?, limit?, includeDetail? }; 默认 `[{}]` 返回 { count, items: [{ id, hookName, title, ts, runnerId? }] } 轻量 data-title 列表; 命中后用 { id, includeDetail:true } 二次取 payload/result; **不进 enrichWithSessionRecall 注入**, LLM 主动 query 才看见
- saas.app.conversation.currentSession.set — 设置当前会话临时字段 (单进程内存, 不落库, 不替代 sessionData/callHistory)
- saas.app.conversation.currentSession.get — 读取当前会话临时态快照 (fields / initTip / pendingAction / hookCalls)
- saas.app.conversation.currentSession.context — 读取当前会话**完整上下文** :: { me, peer, session, time }; me/peer 含 principalId+principalType+displayName+tenantId; peer 还含 ip (来自最近触发端 HTTP 请求 metadata.senderIp) + lastMessageId + lastMessageAt; session 含 type/name/creatorId/memberCount/members[]; time 含 iso/epochMs/timezone/weekday; sessionId 留空 ctx 自动补; 私聊 peer=另一成员, 群聊 peer=最近触发 sender
- ~~saas.app.conversation.initTip~~ — **已下架为 hook**; 改造成 top-level tool `init_tip` (跟 call_hook / search_hook 同级, 见 core/agent-runtime/tools/init-tip.tool.ts); LLM 第一步调 `init_tip({needKnowledge, needHook, reason?})` 拿 `{ suggestedChain, tipNote }`; 不再返回 callHistoryHints / handbookInventory / activeDirectives 等具体数据 — LLM 想看自己调 callHistory.query / sessionData.list+get / knowledge.* hook
- saas.app.conversation.currentSession.setPendingAction — needHook=true 但业务 hook 参数不足或能力不存在时, 写入 pendingAction(stage=missing_args/not_found / hookName / domain / action / missingFields / collectedFields / question / reason) 并通过 sendMsg 追问或说明限制; 作为本轮合法非执行出口
- saas.app.conversation.currentSession.clearPendingAction — 用户取消或业务 hook 成功后清除 pendingAction
  · key 派生 category :: key 第一段决定分类 (handbook / directive / preference / recipe / knowledge / hook / entity / 其他归 general); knowledge/hook/entity 为旧分类兼容, 新链路不再自动沉淀
  · **handbook 必读 + 身份过滤** :: handbook.* 是 SessionHandbookSeederService 按 agent 角色 seed 的技能手册槽位; list 渲染时按当前 ctx.principalId 严格过滤, 群聊多 agent 互不可见对方手册 (createdUser === principalId 才可见)
  · **三条通道分工** :: callHistory = 成功 hook 的原始事实池 (实体 id/path/result 从这里找); knowledge = 权威知识源 (需要时重新读); sessionData = handbook + 会话偏好/约束 directive/preference + 少量显式 recipe; 别混用
  · ⚠ 不再自动注入 user message :: 早期版本把全部 session_data 拼到 systemPrompt 中段 (注意力衰减) / 拼 messages 末尾 (噪声过大) / 仅拼 directive/preference 到最后一条 user message 都已废弃; AgentRuntime 现在只补 currentSessionGuard, 不再读 sessionData 注入
  · ✅ 现行方案 :: base-llm prompt 强约束 **禁止编造真实数据/调用** (第一人称 identity + examples + knowledgeCatalog inventory); LLM 第一步必调 **`init_tip` top-level tool** (跟 call_hook 平级, 不走 hook 路由), 拿 `{ suggestedChain, tipNote }` 推荐链路 + 一句话链路介绍; LLM 想看具体 callHistory / handbook / directive 自己调对应 hook (callHistory.query / sessionData.list+get / knowledge.*); handbook 段按 ctx.principalId 在 service 层自动过滤
  · ⏸ lazy guard 暂禁用 (保留字段填充供监控) :: AgentRuntime 仍幂等补齐 `currentSessionGuard` 强制块保护 prompt cache 前缀; evaluateToolGuard 永远返回 `lazy: false`, retry 链路 dead code 但代码保留; 字段 didInitTip / didEvidenceHook / didPendingAction / declaredInitTip / inferredInitTip 仍正常填充, 后续如需重启 lazy 只 flip lazy=true 即可; 当前 init_tip suggestions + reasoning ≥ 20 + examples 三层 prior 已形成主防线, prior 收敛后再视情况启用 retry
  · ⚠ list 不返 value/preview :: 后期记忆量上来 list 输出仍可控; 命中后调 get 拿完整 value; **这要求 title 必须写得足够描述性, 否则 list 视图无效**
  · key 字符集 `[a-zA-Z0-9_.-]` 1-128 字符; 上限 单 key 10KB, 总量 200KB, 50 个 key; call_log 单独算, FIFO 50 条/session
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
- module.md：模块说明与规范

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
- IM Agent 消息读取 ↔ im agent message read ↔ services/im-message.service.ts (**user envelope v3 已弃用**, toDialogueMessage 直读 msg.content 原话; metadata.llmContent / llmGuidanceEnvelopeVersion / currentSessionRetry 字段是历史包袱, 不再读不再写; 已进入 chat_session_smart 的历史只传 `[conversation_smart_history]` 摘要索引, 需要细节先 smartSearch 再 smartMessages 展开; 引导改由 init_tip suggestions + system prompt examples + call_hook reasoning ≥ 20 承担)
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
- WebMCP Hook ↔ webmcp hook ↔ controllers/webmcp.gateway.ts
- 主动发消息 Hook ↔ send message hook ↔ controllers/im.controller.ts
- Smart历史检索 Hook ↔ smart history hook ↔ controllers/conversation.controller.ts
- Smart历史分段写入 ↔ smart history segment writer ↔ services/chat-session-smart.service.ts (scheduleAnalyze / analyzeSession; 按模型阈值 + LLM 摘要回退规则)
- 会话级互斥锁 ↔ session-level mutex ↔ services/session-lock.service.ts (runExclusive)
- LLM 摘要生成 ↔ llm summary keyword generator ↔ services/smart-llm-generator.service.ts (generate)
- 必读手册 seed ↔ handbook seeder ↔ services/session-handbook-seeder.service.ts (ensureForAgent)
- session_data 分类 ↔ session-data category ↔ services/ai-session-data.service.ts (deriveCategory)
- 调用日志硬记录 ↔ call_hook log hard-record ↔ services/ai-call-log.service.ts (append, evictOld, query)
- 调用历史查询 ↔ call history query hook ↔ controllers/ai-call-log.hook-controller.ts (handleQuery)
- 当前会话临时态 ↔ current session temp state ↔ services/current-session.service.ts (beginTurn / setinitTip / setPendingAction / clearPendingAction / evaluateToolGuard)
- 当前会话判定 Hook ↔ current session initTip hook ↔ controllers/current-session.hook-controller.ts (handleinitTip / handleSetPendingAction / handleClearPendingAction)

# 关键词到文件函数哈希映射（Keywords -> Function Hash）
- ConversationGroupController.listGroups -> 98f1c2a7
- ConversationGroupController.listGroupHistory -> 3b7d5e21
- ConversationService.chat -> 5c2ea110
- ConversationService.chatStream -> a8d44c6f
- ConversationService.getSessionHistory -> 1d9b7e02
- ImMessageService.getMessages -> im_msg_get_001
- ImMessageService.resolveAgentTargetIds -> im_msg_agent_target_001
- laterMessageId(a, b) — 取两个 UUIDv7 消息 ID 中时间更靠后的一个 | keywords: later-message-id -> im_msg_later_message_001
- isMessageIdAfter(id, cursor) — 判断消息 ID 是否晚于给定游标; 游标为空时默认通过 | keywords: message-id-after -> im_msg_message_after_001
- ImMessageService.withStructuredLlmGuidance -> im_msg_structured_guidance_001 (构建含 currentSessionGuard 的 v3 LLM envelope)
- ImMessageService.hasCompactCurrentSessionGuard(guard) — 判断旧版 guard 是否已是当前短结构 | keywords: current-session-guard, cache-stability, compact-shape -> im_msg_structured_guard_compact_001
- ImMessageService.ensureStructuredLlmGuidanceGuard(content, fallbackContent) — 给旧版 llmContent 幂等补齐 currentSessionGuard, 保护历史消息 prompt cache 前缀 | keywords: structured-guidance, cache-stability, current-session-guard -> im_msg_structured_guard_002
- ImMessageService.buildCurrentSessionGuardRequirement(task) — 构建强制 initTip 的短 user envelope 字段 | keywords: current-session-guard, mandatory-tool, structured-guidance -> im_msg_current_session_guard_003
- ImMessageService.runNormalDialogue(agent, payload, messages, retryAttempt?) — 普通模式执行 LLM, lazy guard 命中自动重试一次 | keywords: run-normal-dialogue, lazy-retry -> im_msg_normal_retry_004
- ImMessageService.withLazyRetryNudge(messages, guard) — 给第二次尝试兜底追加 currentSessionRetry 强提示, DB meta 为主来源 | keywords: lazy-retry-nudge, current-session-guard -> im_msg_lazy_retry_nudge_005
- ImMessageService.mergeLazyRetryNudgeIntoContent(content, retry, block) — retry 时优先把提示写入 JSON envelope 的 currentSessionRetry 字段 | keywords: merge-lazy-retry-nudge, json-envelope -> im_msg_lazy_retry_merge_006
- readBooleanPath(value, key) — 从未知对象读取 boolean 字段 | keywords: read-boolean-field -> im_msg_bool_field_001
- ImMessageService.buildLazyRetryNudge(guard) — 构建第二次尝试使用的强 currentSessionRetry JSON, 缺失 initTip 时明确纯聊天只需先声明 false/false 再 sendMsg | keywords: build-lazy-retry-nudge -> im_msg_lazy_retry_build_007
- ImMessageService.persistLazyRetryNudgeToTriggerMessage(triggerMessageId, guard) — 把 lazy retry JSON 持久化到触发消息 meta | keywords: persist-lazy-retry-nudge, metadata-envelope -> im_msg_lazy_retry_persist_008
- ImMessageService.renderLazyRetryNudgeBlock(retry) — 渲染非 JSON 消息使用的 current_session_retry 文本块 | keywords: render-lazy-retry-nudge -> im_msg_lazy_retry_render_009
- ImMessageService.mergeMetadataLazyRetryNudge(content, value) — 从消息 meta 读取 currentSessionRetry 并拼回 LLM envelope | keywords: merge-metadata-lazy-retry -> im_msg_lazy_retry_meta_merge_010
- ImMessageService.readLazyRetryNudge(value) — 校验并读取 meta 中持久化的 currentSessionRetry JSON | keywords: read-lazy-retry-nudge -> im_msg_lazy_retry_read_011
- ImMessageService.readLazyRetryPreviousDecision(value) — 校验并读取 retry meta 中的第一次 currentSession 判定快照 | keywords: read-lazy-retry-previous-decision -> im_msg_lazy_retry_prev_012
- ImMessageService.readLazyRetryPendingAction(value) — 读取 retry meta 中的 pendingAction 快照 | keywords: read-lazy-retry-pending-action -> im_msg_lazy_retry_pending_013
- ImMessageService.readInitTipSnapshot(value) — 读取 initTip 快照对象 | keywords: read-need-some-think-snapshot -> im_msg_need_snapshot_014
- ImMessageService.discardLatestReplyForLazyRetry(sessionId, agentPrincipalId, triggerMessageId, guard) — 主动模式重试前软删第一次无效回复 | keywords: discard-lazy-retry-reply, soft-delete -> im_msg_lazy_retry_discard_015
- ImMessageService.buildGuidanceTask(content) — 从用户原文推导轻量任务标签 | keywords: guidance-task, structured-guidance, intent-detect -> im_msg_guidance_task_002
- ImMessageService.ensureCurrentSessionMustCode(codes) — 确保 v3 user envelope 的 must 列表显式包含 initTip 首步 | keywords: current-session-must, mandatory-tool -> im_msg_current_session_must_015
- ImMessageService.buildGuidanceMustCodes(task) — 把任务标签转换为 envelope must 字段的行为代号 (ID 自解释, base prompt v5 不再附字典); 所有任务追加 init_tip_first, 非聊天任务追加 resolve_terms_by_knowledge, 能力/平台任务追加 unknown_discovery_order | keywords: must-codes, structured-guidance, tool-planning -> im_msg_guidance_must_003
- ImMessageService.buildGuidanceRefs(task) — 把任务标签转换为 envelope refs 字段的提示锚点; 与 base prompt examples 配合体现, base prompt 不再附字典 | keywords: envelope-refs, structured-guidance, anchor-hints -> im_msg_guidance_refs_004
- ImMessageService.resolveGuidanceDomain(normalized) — 识别用户请求的平台业务域 | keywords: guidance-domain, intent-detect, structured-guidance -> im_msg_guidance_domain_005
- ImMessageService.resolveGuidanceIntent(normalized) — 识别用户请求的动作意图 | keywords: guidance-intent, intent-detect, structured-guidance -> im_msg_guidance_intent_006
- ImMessageService.isPreviousResultReference(normalized) — 判断用户是否引用上一轮或工具结果 | keywords: previous-result, context-reference, intent-detect -> im_msg_guidance_previous_007
- ImMessageService.isContextualFollowup(normalized) — 判断用户短答是否依赖前文语境继续执行 | keywords: contextual-followup, short-reply, intent-detect -> im_msg_guidance_followup_008
- ImMessageService.isCapabilityOrActionTask(content) — 判断用户文本是否应进入平台能力/action 提示, 包含员工/成员/应用/提醒等同义触发词 | keywords: is-capability-or-action-task -> im_msg_guidance_capability_009
- ImMessageService.buildAgentInvocationContext -> im_msg_agent_ctx_001 (SaaS hook 鉴权主体以 agent principalId 为准, tenantId 跟随当前触发用户, principalType 固定按 agent 注入, 日志打印 sender/agent tenant 对比)
- ImMessageService.buildAgentRuntimeContext -> im_msg_agent_runtime_ctx_001 (把当前 agent 元信息和业务 tenant 作为 AgentRuntime 前置上下文注入, 仅辅助 LLM 认知, 不参与鉴权)
- ImMessageService.buildAgentDialogueMessages(args) — 重排 agent 对话上下文, 已进入 smart 的历史替换为摘要索引, pending 保留原消息 | keywords: build-agent-dialogue-messages, context-reorder, pending-db-bound, group-chat-filter, smart-context -> im_msg_agent_dialogue_messages_001
- ImMessageService.toSmartDigestMessage(sessionId, digest) — 把 smart 历史摘要索引转换为 LLM 可见的 assistant 上下文消息, 避免中途插入 system role | keywords: smart-context-message, history-summary, context-compression -> im_msg_smart_digest_message_001
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
- ImController.handleSendMsg(payload, _principal, context) — 主动对话 sendMsg hook; LLM context.extras.triggerMessageId 优先绑定 replyToId, 无 LLM context 时沿用 payload.replyToId | keywords: send-msg, proactive, reply-to-id -> im_hook_send_msg_028
- WebMcpGateway.handleWebControl -> webmcp_hook_control_029
- WebMcpGateway.handleWebControlPageInfo -> webmcp_hook_page_info_030
- WebMcpGateway.handleWebControlData -> webmcp_hook_data_031
- WebMcpGateway.handleWebControlStatus -> webmcp_hook_status_032
- ConversationController.handleSmartTags -> conv_hook_smart_tags_033
- ConversationController.handleSmartSearch -> conv_hook_smart_search_034
- ConversationController.handleSmartMessages -> conv_hook_smart_messages_035
- ChatSessionSmartService() — 按模型阈值累计可见正文生成 chat_session_smart 分段索引, 优先 LLM 摘要+关键词, 失败回退规则; sessionLock 串行 | keywords: session-smart, history-index, segment-summary, keywords, model-threshold, session-serial -> chat_session_smart_service_001
- ChatSessionSmartService.scheduleAnalyze(sessionId) — 延迟触发会话 smart 分段分析, 多条消息会被 debounce 合并 | keywords: schedule-smart-analysis, debounce, session-index -> chat_session_smart_schedule_002
- ChatSessionSmartService.analyzeSession(sessionId) — 分析指定会话的未索引消息, 每累计到阈值写入一个 smart 段; 外层 sessionLock.runExclusive 串行 | keywords: analyze-smart-session, segment-write, session-index, session-serial -> chat_session_smart_analyze_003
- ChatSessionSmartService.analyzeSessionInner(sessionId) — analyzeSession 实际工作体, 假设外层已持锁; 内部循环 build → llm-enrich → save | keywords: analyze-session-inner -> chat_session_smart_analyze_inner_003b
- ChatSessionSmartService.getContextDigest(sessionId, beforeMessageId) — 读取 LLM 上下文用的 smart 历史摘要索引, 不展开原消息 | keywords: smart-context-digest, history-summary, context-compression -> chat_session_smart_context_004
- ChatSessionSmartService.resolveModelContext(pending) — 从 pending 消息 senderIds 反查 agents, 取首个有 aiModelIds 的 agent, 读 ai_models.smart_segment_chars 决定阈值 + 后续 LLM enrich 用的 modelId; 无匹配 → 默认 5000 + modelId=null | keywords: resolve-model-context, segment-threshold, agent-model -> chat_session_smart_resolve_model_004b
- ChatSessionSmartService.tryLlmEnrich(modelId, seg) — 调 SmartLlmGeneratorService 生 summary+keywords, 失败 (含 modelId=null) 回退 segment 自带 ruleSummary/ruleKeywords | keywords: llm-enrich-fallback, smart-generate, rule-fallback -> chat_session_smart_llm_enrich_004c
- ChatSessionSmartService.loadPendingMessages(sessionId) — 读取最后一个 smart 段之后尚未索引的可见文本消息 | keywords: pending-smart-messages, smart-cursor, visible-text -> chat_session_smart_pending_005
- ChatSessionSmartService.buildSegmentFromMessages(messages, targetChars) — 从待分析消息中截取一个达到 targetChars 阈值的 smart 段, 同时生成兜底规则 summary/keywords + 原始拼接 text 供 LLM enrich | keywords: build-smart-segment, char-threshold, history-index, fallback-summary -> chat_session_smart_segment_006
- isSegmentableMessage(msg) — 判断消息是否适合进入 smart 分段索引 | keywords: segmentable-message, smart-segment -> chat_session_smart_filter_007
- visibleMessageText(msg) — 读取消息可见正文, 不使用 metadata.llmContent 等隐藏提示 | keywords: visible-message-text, hidden-prompt-isolation -> chat_session_smart_visible_008
- countTextChars(text) — 统计文本长度, 作为配置分段阈值依据 | keywords: text-char-count, segment-threshold -> chat_session_smart_count_010
- flattenSegmentText(messages) — 拼接 smart 段内所有可见消息正文, 带 sender 前缀供 LLM 识别角色 | keywords: smart-text, message-flatten -> chat_session_smart_flatten_011
- summarizeSegment(messages) — 规则兜底摘要 (LLM 不可用时使用), 直接截断 sender 前缀拼接文本 | keywords: rule-summary, smart-summary-fallback -> chat_session_smart_summary_012
- extractKeywords(text) — 从 smart 段文本中提取中英文关键词 (规则算法, LLM 失败兜底) | keywords: keyword-extraction, smart-tags -> chat_session_smart_keywords_013
- SessionLockService.runExclusive(sessionId, label, fn) — 同 sessionId 多次调用严格 FIFO 串行, fn 异常不污染后续任务, 跑完自动清空 tail 防内存泄漏; 用于 smart 压缩 + 各 agent 对话相互排队 | keywords: run-exclusive, session-mutex, serial-execution, compress-dialogue-sync -> session_lock_run_exclusive_001
- SessionLockService.isBusy(sessionId) — debug 判断当前 session 是否有任务在排队/跑 | keywords: session-lock-busy -> session_lock_is_busy_002
- SmartLlmGeneratorService.generate(modelId, text) — 让 modelId 模型读会话段正文输出严格 JSON `{summary, keywords:{zh,en}}`, 失败 (LLM 不可用 / JSON 解析错 / 字段格式不对) throw 由调用方回退规则算法 | keywords: generate-summary-keywords -> smart_llm_generate_001
- parseJsonLoose(raw) — 容错解析 JSON: 直接 parse 失败时剥 ```json fence 再 parse, 仍失败找首尾大括号子串 | keywords: parse-json-loose, strip-code-fence -> smart_llm_parse_json_002
- flattenSmartKeywords(keywords) — 展平 smart keywords, 用于 LLM 上下文摘要索引 | keywords: smart-keywords, context-digest -> chat_session_smart_flatten_keywords_014
- truncateSmartSummary(summary) — 截断 smart summary, 避免摘要索引重新撑爆上下文 | keywords: smart-summary, context-truncate -> chat_session_smart_truncate_015
- tokenizeChineseKeywords(text, limit) — 基于中文二字词频提取关键词 | keywords: chinese-keywords, bigram-frequency -> chat_session_smart_zh_016
- tokenizeEnglishKeywords(text, limit) — 基于英文词频提取关键词 | keywords: english-keywords, word-frequency -> chat_session_smart_en_017
- rankTokens(counts, limit) — 按词频与长度稳定排序关键词 | keywords: rank-keywords, frequency -> chat_session_smart_rank_018
- CurrentSessionService.beginTurn(sessionId, principalId) — 开始新一轮临时态, 清空 initTip 与 hookCalls | keywords: begin-current-session-turn -> current_session_begin_036
- CurrentSessionService.setFields(sessionId, principalId, fields) — 合并当前会话临时字段 | keywords: set-current-session-fields -> current_session_set_fields_037
- CurrentSessionService.setInitTip(sessionId, principalId, input) — 设置 needKnowledge/needHook 固定判定字段 | keywords: set-init-tip, declared-flags -> current_session_init_tip_set_038
- CurrentSessionService.setPendingAction(sessionId, principalId, input) — 设置待补参数/待确认的平台动作 | keywords: set-current-session-pending-action -> current_session_pending_set_039
- CurrentSessionService.clearPendingAction(sessionId, principalId) — 清除当前会话挂起的平台动作 | keywords: clear-current-session-pending-action -> current_session_pending_clear_040
- CurrentSessionService.recordHookCall(sessionId, principalId, hookName, ok) — 记录本轮 call_hook 调用成功情况, 匹配的业务 hook 成功后清理 pendingAction | keywords: record-current-session-hook-call -> current_session_record_hook_041
- CurrentSessionService.inferInitTipFromMessages(messages) — 从结构化消息推导 JS 兜底工具需求 (用于 evaluateToolGuard 兜底, 不参与 initTip 真实声明) | keywords: infer-init-tip-from-messages -> current_session_infer_042
- CurrentSessionService.produceInitTip(declared) — 同步返 `{ directHooks, discoveryChains: { callLog, knowledge, hook }, usageRules, tipNote }`; **directHooks** 是已知常用 hook 快捷入口 (currentSession.context 拿双方身份+IP+时间 / get 拿临时态 / setPendingAction 挂起 / callHistory.query), 不需要走发现链路; discoveryChains 是发现链路明细; usageRules 是 cross-cutting 行为约束 | keywords: produce-init-tip-suggestions, direct-hooks, discovery-chains, usage-rules -> current_session_produce_tip_042b
- CurrentSessionService.getContextSnapshot(sessionId, myPrincipalId) — 异步聚合当前会话上下文 :: 双方 principal 信息 + peer IP (metadata.senderIp) + 会话元数据 + 服务器时间; 私聊 peer 取另一成员, 群聊 peer 取最近一条非 me/非 system 消息的 sender; 注入 messageRepo/sessionRepo/memberRepo/principalRepo | keywords: get-current-session-context-snapshot, peer-ip-from-metadata, session-snapshot -> current_session_context_042c
- CurrentSessionService.evaluateToolGuard(sessionId, principalId, inferred) — **lazy 暂禁用** (永远返回 lazy: false), 字段填充保留供监控 (didInitTip / didEvidenceHook / didPendingAction / didPendingActionDelivery / declaredInitTip / inferredInitTip / pendingAction / successfulHookNames); 后续启用 flip lazy=true 即可 | keywords: evaluate-tool-guard, lazy-disabled, monitor-only -> current_session_guard_043
- normalizePendingAction(input) — 归一化 pendingAction, 限制缺失字段与文本长度 | keywords: normalize-pending-action -> current_session_pending_normalize_044
- clonePendingAction(input) — 克隆 pendingAction 快照 | keywords: clone-pending-action -> current_session_pending_clone_045
- isPendingActionGuardExit(input) — 判断 pendingAction 是否可作为缺参追问/能力不存在的合法非执行出口 | keywords: pending-action-guard-exit -> current_session_pending_exit_046
- isPendingActionFollowup(input) — 判断本轮是否像是在继续 pendingAction | keywords: pending-action-followup -> current_session_pending_followup_047
- isSameHookName(expected, actual) — 判断 pendingAction 记录的 hookName 是否匹配真实调用名 | keywords: match-pending-action-hook-name -> current_session_hook_match_048
- truncateText(text, max) — 截断 currentSession 临时文本 | keywords: truncate-current-session-text -> current_session_truncate_text_049
- CurrentSessionHookController.handleSet(payload, _principal, context) — currentSession.set hook 临时字段写入 | keywords: hook-current-session-set -> current_session_hook_set_050
- CurrentSessionHookController.handleGet(payload, _principal, context) — currentSession.get hook 临时态读取 | keywords: hook-current-session-get -> current_session_hook_get_051
- CurrentSessionHookController.handleContext(payload, _principal, context) — saas.app.conversation.currentSession.context hook, 调 service.getContextSnapshot 返回会话完整上下文 (双方主体 + peer IP + 会话元数据 + 服务器时间) | keywords: hook-current-session-context, peer-info, server-time -> current_session_hook_context_052b
- CurrentSessionHookController.handleSetPendingAction(payload, _principal, context) — currentSession.setPendingAction hook 写入缺参追问挂起态 | keywords: hook-current-session-set-pending-action -> current_session_hook_pending_set_053
- CurrentSessionHookController.handleClearPendingAction(payload, _principal, context) — currentSession.clearPendingAction hook 清除缺参追问挂起态 | keywords: hook-current-session-clear-pending-action -> current_session_hook_pending_clear_054
- isEvidenceHook(hookName) — 判断 hook 是否可作 evidence (排除 currentSession.* / sendMsg; init_tip 是 tool 不会出现在 hookCalls) | keywords: is-evidence-hook -> current_session_is_evidence_055
- buildDirectHooks() — 构造已知常用 hook 快捷入口 (currentSession.context/get/setPendingAction + callHistory.query); 4 条字符串, 直接告诉 LLM "想拿身份/IP/时间不要 search, 直接调 currentSession.context" | keywords: build-direct-hooks, known-shortcut-hooks -> current_session_direct_hooks_057b
- buildDiscoveryChains() — 构造三大标准发现链路 (callLog/knowledge/hook), 静态返回完整三条; 每条按 ①→②→③→④→⑤ 顺序 (tag → search → detail → call → sendMsg) | keywords: build-discovery-chains, tag-search-detail -> current_session_chain_058
- buildUsageRules() — 构造 4 条 cross-cutting 行为约束 (commit early / no loops / no skip / must sendMsg); 集中行为规则在 init_tip 返回里, 不污染 system prompt 或 tool description | keywords: build-usage-rules, commit-early, no-loops, must-send-msg -> current_session_usage_rules_058b
- buildTipNote(declared) — 构造 init_tip tipNote 一句话本轮总览, 按 declared 强调走哪条链路 | keywords: build-tip-note -> current_session_tip_note_059

备注
- 本文件仅用于目录与规范说明，便于 IDE 与开发者快速了解模块结构；不参与构建。
