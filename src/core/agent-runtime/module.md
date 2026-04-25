# AgentRuntime 模块

提供基于目录的 Agent 动态加载与对话接入能力。Agent 文件在运行时被 transpile（CJS）并实例化，对话层通过 `startDialogue` 触发。
每个加载的 Agent 工具集始终包含 `call_hook`、`call_hook_async`、`call_hook_batch_sync`、`call_hook_batch` 四个通用 HookBus 工具，且系统提示词中始终注入 Hook 工具使用说明和知识库读取说明。

## 文件列表

### services/agent-runtime.service.ts
`AgentRuntimeService` — Agent 运行时主服务

- `load(inputDir)` — 加载 Agent 目录，注入 4 个 hook 工具 | keywords: load-agent, inject-tools
- `startDialogue(agentDir, messages, options)` — 启动对话流，支持主动对话模式系统提示 | keywords: start-dialogue, proactive-chat
- `getTools(agentDir)` — 获取 Agent 工具集（含 call_hook* 4 个） | keywords: get-tools
- `buildAiAdapter()` — 构建 AI 适配器，始终注入 base system prompt | keywords: ai-adapter, base-prompt

### services/agent-loader.service.ts
`AgentLoaderService` — 负责从目录中加载 Agent TypeScript 文件

- `loadAll(inputDir)` — 加载 handle + dialogues，返回 LoadedAgent | keywords: load-all, transpile

### tools/call-hook.tools.ts
通用 HookBus LangChain 工具构建函数

- `buildCallHookTool(hookBus)` — 同步调用，等待 handler 返回结果 | keywords: call-hook-tool, sync
- `buildCallHookAsyncTool(hookBus)` — fire-and-forget，立即返回 | keywords: call-hook-async-tool
- `buildCallHookBatchSyncTool(hookBus)` — 批量同步，并发等待全部结果 | keywords: call-hook-batch-sync-tool
- `buildCallHookBatchTool(hookBus)` — 批量 fire-and-forget | keywords: call-hook-batch-tool

### prompts/base-llm.prompt.ts
基础 LLM 系统提示词

- `buildBaseLlmSystemPrompt()` — 生成 Hook 工具使用说明 + 知识库读取说明 | keywords: base-llm-prompt

### types/agent-runtime.types.ts
- `LoadedAgent` — Agent 加载结果类型（tools, dialogues, description）
