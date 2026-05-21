# AgentRuntime 模块

提供基于目录的 Agent 动态加载与对话接入能力。Agent 文件在运行时被 transpile (CJS) 并实例化, 对话层通过 `startDialogue` 触发。
每个加载的 Agent 工具集始终包含 5 个内置 Hook 工具 (`call_hook` / `call_hook_async` / `search_hook` / `get_hook_tag` / `get_hook_info`), 且系统提示词中始终注入 Hook 发现流程说明和知识库读取说明。

5 个工具都支持 `target` 参数路由:
- `target='saas'` (默认) → 走本进程 HookBus / Registry
- `target='runner'` → 走 RunnerHookRpcService 经 /runner/ws 派发到指定 `runnerId`
- `call_hook` / `call_hook_async` 会按 hookName 前缀归一化目标端: `saas.*` 强制 SaaS, `runner.*` 强制 Runner, 避免 LLM 省略或误填 target 导致错路由
统一返回外形 `{ errorMsg, result, debugLog }`, errorMsg 非空即软错让 LLM 纠正。

调用上下文 (token / principalId / traceId / tenantId) 通过 `options.invocationContext` 由调用方填入, 工具层闭包持有, LLM schema 完全不暴露,
保证 LLM 不可见不可改 token。AgentRuntime 自身不解析 token, 解析在 SaaS HookAuthMiddleware 完成。IM 入口会同时传 `agentContext`, 将当前 agent 元信息和业务 tenant 作为前置系统上下文补充给 LLM；鉴权仍只看 invocationContext.principalId。

## 文件列表

### services/agent-runtime.service.ts
`AgentRuntimeService` — Agent 运行时主服务

- `load(inputDir, invocationContext?)` — 加载 Agent 目录, 注入 5 个 hook 工具 (闭包持有 ctx); call_hook 副作用同时落 SessionCallTracker (内存) 和 AiCallLogService (持久化, 仅成功项) | keywords: load-agent, inject-tools, ctx-closure, call-log-sink
- `startDialogue(agentDir, messages, options)` — 启动对话流, options 含 proactiveContext / invocationContext / agentContext | keywords: start-dialogue, proactive-chat, invocation-context, agent-context
- `getTools(agentDir, invocationContext?)` — 获取 Agent 工具集 (含 5 个内置 hook 工具) | keywords: get-tools
- `buildAiAdapter()` — 构建 AI 适配器, 始终注入 JSON system prompt; 将 agent-runtime、proactive-dialogue、agent-definition 作为 `role.*` 字段合并进同一个 JSON, 稳定规则在前、动态角色在后以利于 prompt cache | keywords: ai-adapter, base-prompt, agent-runtime-context, proactive-priority, agent-definition
- `attachDialogue(agent)` — 把 AIModelService 注入对话层 | keywords: attach-dialogue
- `maybeTriggerSaveLlmAfterTurn(ctx, modelIds)` — 整轮结束低频硬匹配命中即异步触发 sinking LLM | keywords: maybe-trigger-save-llm

### services/agent-loader.service.ts
`AgentLoaderService` — 负责从目录中加载 Agent TypeScript 文件

- `loadAll(inputDir)` — 加载 handle + dialogues, 返回 LoadedAgent | keywords: load-all, transpile

### tools/call-hook.tools.ts
LLM Hook 工具集 (5 个 tool 全部 target 路由, 闭包注入 invocationContext)

- `buildCallHookTool(hookBus, hookRpc, getCtx, sideEffects?, options?)` — 同步批量调用 hook; target 默认 SaaS, hookName 前缀归一化目标端; hook-not-found / schema 软错优先提示复用 callHistory, 再 handbook/knowledge/schema; `options.defaultDebug` 注入节点级 debug 默认值, 工厂闭包绑定整个 graph 流 | keywords: call-hook-tool, sync, batch, target-routing, target-normalize, call-history-first, default-debug
- `buildCallHookAsyncTool(hookBus, hookRpc, getCtx, options?)` — 批量 fire-and-forget; target 默认 SaaS, hookName 前缀归一化目标端; 同支持 `options.defaultDebug` | keywords: call-hook-async-tool, batch, target-normalize, default-debug
- `processOneCallAftermath(entry, reply, ctx, sideEffects?)` — per-call 失败追踪 + hint 注入 + 副作用回调 | keywords: aftermath, per-call
- `buildSearchHookTool(hookBus, hookRpc, getCtx)` — 按 tags / pluginName 搜索 hook 注册表 | keywords: search-hook-tool, discovery
- `buildGetHookTagTool(hookBus, hookRpc, getCtx)` — 获取 tag 频次榜 | keywords: get-hook-tag-tool, tag-leaderboard
- `buildGetHookInfoTool(hookBus, hookRpc, getCtx)` — 批量获取 hook 描述+tags+payload schema | keywords: get-hook-info-tool, batch-info
- `dispatchOne(hookBus, hookRpc, ctx, input, defaultDebug)` — 内部统一路由 (saas/runner); debug 三层优先级 (input.debug ?? defaultDebug ?? false) | keywords: dispatch-one, debug-priority
- `dispatchSaasHook(hookBus, ctx, input)` — 适配 SaaS HookBus 结果到统一外形 | keywords: adapt-saas-result
- `normalizeHookCallInput(entry)` — 根据 `saas.*` / `runner.*` hookName 前缀归一化 target, 前缀优先于 target 字段 | keywords: normalize-hook-call-input, target-normalize
- `projectSaasRegistrations(regs)` — 把 SaaS Registry 投影成与 runner meta hook 同形列表 | keywords: project-saas-registrations
- `InvocationContextProvider` (type) — `() => HookInvocationContext` 闭包取值器 | keywords: invocation-context-provider

### services/session-call-tracker.service.ts
`SessionCallTrackerService` — 单进程内存追踪 call_hook 调用, 用于低频硬匹配触发 sinking LLM (records 上限 200 条 LRU)

- `record(sessionId, rec)` — 记一次 call_hook 调用 | keywords: record-call-hook
- `shouldTriggerSave(sessionId)` — 低频硬匹配 (getChapter / 失败后成功 + 冷却时间) | keywords: should-trigger-save
- `resetTriggers(sessionId)` / `getRecords(sessionId)` / `clear(sessionId)` | keywords: tracker-state

### services/session-save-llm.service.ts
`SessionSaveLlmService` — 独立 sinking LLM, 根据 records 决策是否调 sessionData.save (4 类白名单: knowledge/recipe/hook/entity); **禁止写 handbook.\*** (那是系统 seed 槽位)

- `runAsync({ sessionId, aiModelIds, invocationContext })` — fire-and-forget 异步沉淀决策 | keywords: run-async-save-llm
- `buildUserMessage(records, listing)` — 拼 user message 给沉淀 LLM | keywords: build-save-user-message

### prompts/base-llm.prompt.ts
基础 LLM 系统提示词

- `buildBaseLlmSystemPrompt()` — 生成 JSON 基础 system prompt: 明确 `role.system/role.agentRuntime/role.proactiveDialogue/role.agentDefinition` 角色优先级 + 禁止编造真实数据/调用 + v3 结构化 IM JSON 输入识别 (`v/kind/text/task/mode/must/refs`) + guidanceCodes/sectionRefs 代号解释 + knowledgeCatalog 常驻知识库名称与真实 tags + semanticResolution 同义词语义归一 + 工具协议 + 未知情况固定按 sessionData -> knowledge -> hook registry/schema 查证 + 复杂 hook 任务按需发现链路 (callHistory/sessionData/knowledge/hook registry) + batch/错误处理约束 | keywords: base-llm-prompt, prompt-priority, no-fabrication, structured-im-input, conditional-discovery, batch-plan
- `LlmSystemPromptJson` (type) — system prompt JSON 合同, 供基础提示、guidanceCodes/sectionRefs 与运行时 `role.*` 注入共用 | keywords: system-prompt-json, role-json, prompt-contract

### types/agent-runtime.types.ts
- `LoadedAgent` — Agent 加载结果类型 (tools, dialogues, descriptor)
- `AgentDescriptor` — agent.desc.ts 解析结果; `{ name, description, supportDialogue, defaultDebug? }`; defaultDebug 节点级 call_hook debug 开关, 工厂闭包绑定整个 graph 流 | keywords: agent-descriptor, default-debug
