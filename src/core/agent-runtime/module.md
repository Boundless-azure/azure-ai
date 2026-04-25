# AgentRuntime 模块

提供基于目录的 Agent 动态加载与对话接入能力。Agent 文件在运行时被 transpile (CJS) 并实例化, 对话层通过 `startDialogue` 触发。
每个加载的 Agent 工具集始终包含 5 个内置 Hook 工具 (`call_hook` / `call_hook_async` / `search_hook` / `get_hook_tag` / `get_hook_info`), 且系统提示词中始终注入 Hook 发现流程说明和知识库读取说明。

5 个工具都支持 `target` 参数路由:
- `target='saas'` → 走本进程 HookBus / Registry
- `target='runner'` (默认) → 走 RunnerHookRpcService 经 /runner/ws 派发到指定 `runnerId`
统一返回外形 `{ errorMsg, result, debugLog }`, errorMsg 非空即软错让 LLM 纠正。

调用上下文 (token / principalId / traceId) 通过 `options.invocationContext` 由调用方填入, 工具层闭包持有, LLM schema 完全不暴露,
保证 LLM 不可见不可改 token。AgentRuntime 自身不解析 token, 解析在 SaaS HookAuthMiddleware 完成。

## 文件列表

### services/agent-runtime.service.ts
`AgentRuntimeService` — Agent 运行时主服务

- `load(inputDir, invocationContext?)` — 加载 Agent 目录, 注入 5 个 hook 工具 (闭包持有 ctx) | keywords: load-agent, inject-tools, ctx-closure
- `startDialogue(agentDir, messages, options)` — 启动对话流, options 含 proactiveContext / invocationContext | keywords: start-dialogue, proactive-chat, invocation-context
- `getTools(agentDir, invocationContext?)` — 获取 Agent 工具集 (含 5 个内置 hook 工具) | keywords: get-tools
- `buildAiAdapter()` — 构建 AI 适配器, 始终注入 base system prompt | keywords: ai-adapter, base-prompt
- `attachDialogue(agent)` — 把 AIModelService 注入对话层 | keywords: attach-dialogue

### services/agent-loader.service.ts
`AgentLoaderService` — 负责从目录中加载 Agent TypeScript 文件

- `loadAll(inputDir)` — 加载 handle + dialogues, 返回 LoadedAgent | keywords: load-all, transpile

### tools/call-hook.tools.ts
LLM Hook 工具集 (5 个 tool 全部 target 路由, 闭包注入 invocationContext)

- `buildCallHookTool(hookBus, hookRpc, getCtx)` — 同步调用 hook, 等待结果 | keywords: call-hook-tool, sync, target-routing
- `buildCallHookAsyncTool(hookBus, hookRpc, getCtx)` — fire-and-forget, 立即返回 | keywords: call-hook-async-tool
- `buildSearchHookTool(hookBus, hookRpc, getCtx)` — 按 tags / pluginName 搜索 hook 注册表 | keywords: search-hook-tool, discovery
- `buildGetHookTagTool(hookBus, hookRpc, getCtx)` — 获取 tag 频次榜 | keywords: get-hook-tag-tool, tag-leaderboard
- `buildGetHookInfoTool(hookBus, hookRpc, getCtx)` — 批量获取 hook 描述+tags+payload schema | keywords: get-hook-info-tool, batch-info
- `dispatchOne(hookBus, hookRpc, ctx, input)` — 内部统一路由 (saas/runner) | keywords: dispatch-one
- `dispatchSaasHook(hookBus, ctx, input)` — 适配 SaaS HookBus 结果到统一外形 | keywords: adapt-saas-result
- `projectSaasRegistrations(regs)` — 把 SaaS Registry 投影成与 runner meta hook 同形列表 | keywords: project-saas-registrations
- `InvocationContextProvider` (type) — `() => HookInvocationContext` 闭包取值器 | keywords: invocation-context-provider

### prompts/base-llm.prompt.ts
基础 LLM 系统提示词

- `buildBaseLlmSystemPrompt()` — 生成 Hook 工具总览 + 发现流程 + 知识库读取说明 | keywords: base-llm-prompt, discovery-flow

### types/agent-runtime.types.ts
- `LoadedAgent` — Agent 加载结果类型 (tools, dialogues, description)
