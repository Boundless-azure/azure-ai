1 模块名称：core/ai（AI 核心模块）

概述
- 提供 AI 模型配置、会话上下文管理和会话摘要生成能力。
- 支持多模型接入：OpenAI、Azure OpenAI、Anthropic、Google Gemini 等。
- 提供会话消息的存储、检索和摘要功能。
- 通过 LangGraph 实现复杂的多步骤推理能力。

文件清单（File List）
- core/ai/ai-core.module.ts
- core/ai/ai-core.service.ts
- core/ai/entities/chat-session.entity.ts
- core/ai/entities/chat-message.entity.ts
- core/ai/entities/round-summary.entity.ts
- core/ai/types/ai.types.ts
- core/ai/config/ai.config.ts
- core/ai/langgraph/

函数清单（Function Index）
- AICoreService
  - createChatSession(principalId, agentId?)
  - sendMessage(sessionId, message, options?)
  - getHistory(sessionId, limit?)
  - createSummary(sessionId)
- ChatSessionEntity
  - id, principalId, agentId, modelId, status, createdAt
- ChatMessageEntity
  - id, sessionId, role, content, functionCall?, result?

关键词索引（中文 / English Keyword Index）
AI核心模块 -> core/ai/ai-core.module.ts
AI服务 -> core/ai/ai-core.service.ts
会话实体 -> core/ai/entities/chat-session.entity.ts
消息实体 -> core/ai/entities/chat-message.entity.ts
摘要实体 -> core/ai/entities/round-summary.entity.ts
AI类型 -> core/ai/types/ai.types.ts

关键词到文件函数哈希映射（Keywords -> Function Hash）
- AICoreService.createChatSession -> ai_session_create_001
- AICoreService.sendMessage -> ai_message_send_002
- AICoreService.getHistory -> ai_history_get_003
- AICoreService.createSummary -> ai_summary_create_004

模块功能描述（Description）
AI 核心模块是系统的大脑：管理 AI 模型的配置与会话生命周期，提供标准化的聊天接口，支持函数调用和多模态交互。会话消息持久化到数据库，支持上下文窗口管理和历史检索。
