1 模块名称：core/ai（AI 核心模块）

概述

- 提供 AI 模型配置、会话上下文管理和会话摘要生成能力。
- 支持多模型接入：OpenAI、Azure OpenAI、Anthropic、Google Gemini、DeepSeek、Kimi、MiniMax、NVIDIA 等。
- 提供会话消息的存储、检索和摘要功能；逐消息关键词已移除，历史 tag 检索统一走 `chat_session_smart`。
- 通过 LangGraph 实现复杂的多步骤推理能力。

文件清单（File List）

- core/ai/ai-core.module.ts
- core/ai/ai-core.service.ts
- core/ai/services/context.service.ts
- core/ai/services/ai-model.service.ts
- core/ai/providers/module.md
- core/ai/providers/kimi-chat-openai.ts
- core/ai/processors/minimax.processor.ts
- core/ai/entities/chat-session.entity.ts
- core/ai/entities/chat-message.entity.ts
- core/ai/entities/base.entity.ts
- core/ai/entities/round-summary.entity.ts
- core/ai/entities/ai-model.entity.ts
- core/ai/types/ai.types.ts
- core/ai/types/ai-model.types.ts
- core/ai/config/ai.config.ts
- core/ai/langgraph/

函数清单（Function Index）

- AICoreService
  - createChatSession(principalId, agentId?)
  - sendMessage(sessionId, message, options?)
  - getHistory(sessionId, limit?)
  - createSummary(sessionId)
- ContextService
  - addMessage(sessionId, message)：仅将消息持久化到 `chat_session_messages`，不再逐条抽取关键词；tag 与摘要检索交给 `chat_session_smart`。 | keywords: message, persistence, audit, trimming
  - getKeywordContext(sessionId, keywords, includeSystem?, limit?, matchMode?)：按消息正文 LIKE 做轻量历史窗口检索，不依赖 `chat_session_messages.keywords`。 | keywords: keyword-filtering, sliding-window, content-search, sqlite-like
  - getKeywordContextByUser(userId, keywords, includeSystem, limit, matchMode?)：在用户范围内按消息正文做轻量历史窗口检索。 | keywords: user-scope, keyword-filtering, sliding-window, content-search, sqlite-like
  - queryUserMessagesByKeywords(userId, keywords, limit, matchMode)：在用户范围内按消息正文 LIKE 查询命中消息。 | keywords: db-query, text-like, content-search
  - queryMessagesByKeywords(sessionId, keywords, limit, matchMode)：在单会话内按消息正文 LIKE 查询命中消息。 | keywords: db-query, text-like, content-search
- AIModelService
  - createModelInstance(config, request)：按 provider 创建 LangChain 模型实例；支持 kimi OpenAI 兼容接口与 minimax OpenAI/Anthropic 兼容接口，并把 request.source 写入创建日志。
  - chat(request)：非流式模型调用；支持 isolateCallbacks 给后台任务隔离 LangChain callbacks，避免继承已关闭的流式 writer；日志包含 request.source 用于区分 graph 节点、对话和后台摘要。
  - extractMessageText(content)：从 string 或 content block 数组提取非流式响应正文。 | keywords: message-text, content-blocks, non-stream-response
  - chatStream(request)：流式模型调用。
  - getModels(provider?, type?)：查询模型配置。
  - getEnabledModels()：查询启用模型配置。
  - resolveModelIdByIds(modelIds)：按模型 ID 列表第一个位置优先解析可用模型 ID。
  - resolveModelIdByNearestSlot(modelIds, preferredIndex)：按指定槽位优先解析模型 ID，目标槽位不存在或不可用时只在传入列表内按距离回退。
  - findActiveModelById(modelId)：按数据库 ID 查找启用模型；模型 name 只在 createModelInstance 内部用于供应商 SDK。 | keywords: find-active-model-by-id, model-selection, active-model
- KimiChatOpenAI
  - withConfig(config)：克隆配置时保持 Kimi 专用 adapter，避免 LangChain bindTools 回退原生 ChatOpenAI。
  - completionWithRetry(request, requestOptions?)：请求前补齐 Kimi assistant tool-call 的 reasoning_content。
  - \_streamResponseChunks(messages, options, runManager?)：流式保留 Kimi reasoning_content。
  - \_generate(messages, options, runManager?)：非流式保留 Kimi reasoning_content。
- ChatSessionEntity
  - id, principalId, agentId, modelId, status, createdAt
- ChatMessageEntity
  - id, sessionId, role, content, functionCall?, result?
- AIModelEntity
  - id, name, displayName, provider, apiProtocol, type, status, apiKey, baseURL, azureConfig?, defaultParams?
  - thinkingEnabled — 思考模式开关 (think/reasoning) 独立 boolean 列, 便于 SQL 过滤/索引 | keywords: thinking-mode-toggle
  - smartSegmentChars — chat_session_smart 后台分段写入用的字符阈值 (int nullable, null → 走代码常量 5000); 不同模型上下文承载力差异大, 长上下文模型可设大 (Claude/Gemini 8000+), 容易"歇菜"的设小 (3000); 由 ChatSessionSmartService.resolveModelContext 取 agent.aiModelIds[0] 对应该字段 | keywords: smart-segment-chars, context-budget, model-aware-summary
- AIProvider
  - openai, anthropic, google, gemini, deepseek, kimi, minimax, nvidia, azure_openai, custom
- BaseAuditedEntity.ensureId() — 插入前生成 UUID v7 主键 | keywords: id-generation, uuid-v7, before-insert

关键词索引（中文 / English Keyword Index）
AI核心模块 -> core/ai/ai-core.module.ts
AI服务 -> core/ai/ai-core.service.ts
AI模型运行时 -> core/ai/services/ai-model.service.ts
模型ID解析 -> core/ai/services/ai-model.service.ts
model-id -> core/ai/services/ai-model.service.ts
Kimi模型适配 -> core/ai/providers/kimi-chat-openai.ts
MiniMax模型适配 -> core/ai/processors/minimax.processor.ts
会话实体 -> core/ai/entities/chat-session.entity.ts
消息实体 -> core/ai/entities/chat-message.entity.ts
上下文服务 -> core/ai/services/context.service.ts
content-search -> core/ai/services/context.service.ts
chat_session_smart -> src/app/conversation/services/smart-llm-generator.service.ts
基础实体 -> core/ai/entities/base.entity.ts
base-entity -> core/ai/entities/base.entity.ts
摘要实体 -> core/ai/entities/round-summary.entity.ts
AI类型 -> core/ai/types/ai.types.ts
AI模型类型 -> core/ai/types/ai-model.types.ts

关键词到文件函数哈希映射（Keywords -> Function Hash）

- AICoreService.createChatSession -> ai_session_create_001
- AICoreService.sendMessage -> ai_message_send_002
- AICoreService.getHistory -> ai_history_get_003
- AICoreService.createSummary -> ai_summary_create_004
- ContextService.addMessage -> message, persistence, audit, trimming
- ContextService.getKeywordContext -> keyword-filtering, sliding-window, content-search, sqlite-like
- ContextService.getKeywordContextByUser -> user-scope, keyword-filtering, sliding-window, content-search, sqlite-like
- ContextService.queryUserMessagesByKeywords -> db-query, text-like, content-search
- ContextService.queryMessagesByKeywords -> db-query, text-like, content-search
- AIModelService.createModelInstance -> model-instance-provider-routing
- AIModelService.chat -> ai_model_chat
- AIModelRequest.source -> model-call-source
- AIModelRequest.isolateCallbacks -> ai-model-isolate-callbacks
- AIModelService.extractMessageText -> message-text, content-blocks, non-stream-response
- AIModelService.chatStream -> ai_model_chat_stream
- AIModelService.resolveModelIdByIds -> resolve-model-id-by-ids
- AIModelService.resolveModelIdByNearestSlot -> resolve-model-id-by-nearest-slot
- AIModelService.findActiveModelById -> find-active-model-by-id, model-selection, active-model
- KimiChatOpenAI.completionWithRetry -> kimi-request-reasoning-content-fallback
- KimiChatOpenAI.withConfig -> kimi-with-config-preserve-adapter
- KimiChatOpenAI.\_streamResponseChunks -> kimi-stream-with-reasoning-content
- KimiChatOpenAI.\_generate -> kimi-generate-with-reasoning-content
- minimaxProcessor.processStreamChunk -> minimax-process-stream-chunk

模块功能描述（Description）
AI 核心模块是系统的大脑：管理 AI 模型的配置与会话生命周期，提供标准化的聊天接口，支持函数调用和多模态交互。Kimi 通过 OpenAI 兼容接口接入，默认 baseURL 为 `https://api.moonshot.cn/v1`，也允许模型配置覆盖；Kimi 专用适配器会保留并回放 reasoning_content，使 thinking + tool calling 可继续使用。MiniMax 支持 OpenAI-compatible 与 Anthropic-compatible 两种接入，默认国内 endpoint，可通过模型配置切换海外 endpoint；MiniMax processor 会把 OpenAI reasoning_split 的 reasoning_details 与 Anthropic thinking block 分离为 reasoning 事件。会话消息持久化到数据库，支持上下文窗口管理和历史检索；逐消息关键词筛分已移除，历史 tag 与摘要检索统一由 conversation 模块的 `chat_session_smart` 分段索引承担；后台摘要等非用户流式响应可通过 `isolateCallbacks` 隔离 LangChain callbacks。
