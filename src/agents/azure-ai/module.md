模块名称：agents/azure-ai（默认对话智能体）

概述
- 提供默认对话层。
- 通过 AgentRuntime 注入的 aiService.useModel(0) 选择默认对话模型。
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
  - handle(messages)

关键词索引（中文 / English Keyword Index）
默认智能体 -> agents/azure-ai/agent.desc.ts
对话层 -> agents/azure-ai/dialogues/dialogues.min.ts
模型槽位选择 -> agents/azure-ai/dialogues/dialogues.min.ts
系统手册引导 -> agents/azure-ai/dialogues/dialogues.min.ts

Keywords (EN)
default-agent -> agents/azure-ai/agent.desc.ts
dialogue-layer -> agents/azure-ai/dialogues/dialogues.min.ts
model-slot-selection -> agents/azure-ai/dialogues/dialogues.min.ts
system-manual-handbook-hint -> agents/azure-ai/dialogues/dialogues.min.ts

关键词到文件函数哈希映射（Keywords -> Function Hash）
- DialoguesClass.handleAiServer -> azure_ai_dialogue_ai_server_001
- DialoguesClass.handle -> azure_ai_dialogue_handle_003

模块功能描述（Description）
该模块作为系统默认对话Agent，在运行时只消费 AgentRuntime 注入的 aiService.useModel(0) 模型槽位客户端完成对话调用，不再直接读取或解析底层模型配置列表。
