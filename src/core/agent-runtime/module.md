# AgentRuntime 模块

提供基于目录的 Agent 动态加载与对话接入能力。Agent 文件在运行时被 transpile（CJS）并实例化，对话层通过 `startDialogue` 触发。
每个加载的 Agent 工具集始终包含 `call_hook`（同步）和 `call_hook_async`（fire-and-forget）两个通用 HookBus 工具。

## 文件列表

### services/agent-runtime.service.ts
`AgentRuntimeService` — Agent 运行时主服务

- `load(inputDir)` — 加载 Agent 目录，注入 call_hook/call_hook_async 工具 | keywords: load-agent, inject-tools
- `startDialogue(agentDir, messages, options)` — 启动对话流，支持主动对话模式系统提示 | keywords: start-dialogue, proactive-chat
- `getTools(agentDir)` — 获取 Agent 工具集（含 call_hook*） | keywords: get-tools
- `buildAiAdapter()` — 构建 AI 适配器供对话层调用 | keywords: ai-adapter

### services/agent-loader.service.ts
`AgentLoaderService` — 负责从目录中加载 Agent TypeScript 文件

- `loadAll(inputDir)` — 加载 handle + dialogues，返回 LoadedAgent | keywords: load-all, transpile

### tools/call-hook.tools.ts
通用 HookBus LangChain 工具构建函数

- `buildCallHookTool(hookBus)` — 构建 call_hook 同步工具 | keywords: call-hook-tool, sync
- `buildCallHookAsyncTool(hookBus)` — 构建 call_hook_async 异步工具 | keywords: call-hook-async-tool, fire-and-forget

### types/agent-runtime.types.ts
- `LoadedAgent` — Agent 加载结果类型（tools, dialogues, description）
