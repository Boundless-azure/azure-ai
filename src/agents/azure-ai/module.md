模块名称：agents/azure-ai（默认对话智能体）

概述
- 提供默认对话层。
- 根据Agent配置的 aiModelIds 选择模型。
- 当未配置模型ID时返回明确错误信息。
- 默认 Agent 定义提示词已改为英文，以提高模型对系统提示与工具约束的命中稳定性。
- 用户询问 Agent / 系统能力范围，或要求使用平台能力执行动作时，提示词要求先读取 sessionData / handbook / knowledge 后再回答或调用，避免编造能力清单与调用路径。
- 执行业务 hook 前先查 callHistory 复用近期成功调用；无命中时能力/动作发现顺序为 handbook -> sessionData -> knowledge -> hook。用户引用“刚刚那条数据”等上一轮工具结果时必须先查 callHistory。

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
系统手册引导 -> agents/azure-ai/dialogues/dialogues.min.ts

Keywords (EN)
default-agent -> agents/azure-ai/agent.desc.ts
dialogue-layer -> agents/azure-ai/dialogues/dialogues.min.ts
model-id-selection -> agents/azure-ai/dialogues/dialogues.min.ts
system-manual-handbook-hint -> agents/azure-ai/dialogues/dialogues.min.ts

关键词到文件函数哈希映射（Keywords -> Function Hash）
- DialoguesClass.handleAiServer -> azure_ai_dialogue_ai_server_001
- DialoguesClass.setAgentConfig -> azure_ai_dialogue_agent_cfg_002
- DialoguesClass.handle -> azure_ai_dialogue_handle_003

模块功能描述（Description）
该模块作为系统默认对话Agent，在运行时使用Agent配置的AI模型ID列表解析可用模型并完成对话调用。
