模块名称：agents/azure-ai（默认对话智能体）

概述
- 提供默认对话层。
- 根据Agent配置的 aiModelIds 选择模型。
- 当未配置模型ID时返回明确错误信息。

文件清单（File List）
- agents/azure-ai/agent.desc.ts
- agents/azure-ai/dialogues/dialogues.min.ts

函数清单（Function Index）
- DialoguesClass
  - handleAiServer(aiServer)
  - setAgentConfig(config)
  - handle(messages)

关键词索引（中文 / English Keyword Index）
默认智能体 -> agents/azure-ai/agent.desc.ts
对话层 -> agents/azure-ai/dialogues/dialogues.min.ts
模型ID选择 -> agents/azure-ai/dialogues/dialogues.min.ts

Keywords (EN)
default-agent -> agents/azure-ai/agent.desc.ts
dialogue-layer -> agents/azure-ai/dialogues/dialogues.min.ts
model-id-selection -> agents/azure-ai/dialogues/dialogues.min.ts

关键词到文件函数哈希映射（Keywords -> Function Hash）
- DialoguesClass.handleAiServer -> azure_ai_dialogue_ai_server_001
- DialoguesClass.setAgentConfig -> azure_ai_dialogue_agent_cfg_002
- DialoguesClass.handle -> azure_ai_dialogue_handle_003

模块功能描述（Description）
该模块作为系统默认对话Agent，在运行时使用Agent配置的AI模型ID列表解析可用模型并完成对话调用。
