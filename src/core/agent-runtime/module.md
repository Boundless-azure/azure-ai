# AgentRuntime 模块

提供基于目录的 Agent 动态加载与对话接入能力。Agent 文件在运行时被 transpile (CJS) 并实例化, 对话层通过 `startDialogue` 触发。
每个加载的 Agent 工具集始终包含 **6 个内置 top-level tool**: 5 个 Hook 工具 (`call_hook` / `call_hook_async` / `search_hook` / `get_hook_tag` / `get_hook_info`) + 1 个 turn-init tool (`init_tip`). `init_tip` 不走 hook 路由, 直接命中 `CurrentSessionService` 写 didInitTip 状态 + 同步生成 suggestedChain/tipNote 推荐.

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

- `load(inputDir, invocationContext?)` — 加载 Agent 目录, 注入 6 个内置 tool (5 hook tools + init_tip top-level tool, 闭包持有 ctx); call_hook 成功项落 AiCallLogService 作为 callHistory, 并记录 currentSession 本轮 hook 成功情况 | keywords: load-agent, inject-tools, ctx-closure, call-log-sink, init-tip-tool
- `startDialogue(agentDir, messages, options)` — 启动对话流, options 含 proactiveContext / invocationContext / agentContext; **user message 直发原话, 不再补 currentSessionGuard / envelope** (引导改由 init_tip + examples + reasoning ≥ 20 承担) | keywords: start-dialogue, proactive-chat, invocation-context, agent-context, raw-user-content
- `getTools(agentDir, invocationContext?)` — 获取 Agent 工具集 (含 5 个内置 hook 工具) | keywords: get-tools
- `buildAiAdapter()` — 构建 AI 适配器, 始终注入 v5 JSON system prompt; 将 agent-runtime / proactive-dialogue / agent-definition 作为 `role.*` 字段合并进同一个 JSON, role 子字段统一第一人称叙述 (myContext / myProactiveBehavior / myDefinitionBehavior); myProactiveBehavior 只承载身份/交付方式 (sendMsg 唯一通道 + ctx 自动补 sessionId/senderPrincipalId/replyToId, 禁止冒充), 不承载发现行为约束 (commit/loop/skip 等规则归 init_tip 的 usageRules) | keywords: ai-adapter, base-prompt, agent-runtime-context, proactive-priority, agent-definition, first-person-behavior, ctx-auto-fill
- `attachDialogue(agent)` — 把 AIModelService 注入对话层 | keywords: attach-dialogue

### services/agent-loader.service.ts
`AgentLoaderService` — 负责从目录中加载 Agent TypeScript 文件

- `loadAll(inputDir)` — 加载 handle + dialogues, 返回 LoadedAgent | keywords: load-all, transpile

### tools/init-tip.tool.ts
init_tip top-level tool (不走 hook 路由, 直接命中 CurrentSessionService)

- `buildInitTipTool(currentSession, getCtx)` — 工厂构造 init_tip tool; schema { needKnowledge, needHook, needHistory?, reason? }; tool 内部直接调 `setInitTip` + `produceInitTip`; description 显式展示 hook fence 字面格式 (` ```hook\n{"actionHook":"...","payload":{...}}\n``` `) 与完整 example (查用户列表→component链路→sendMsg with fence), 避免 LLM 把"hook fence"当抽象词理解; discoveryChains.component 步骤说明包含"不可用 call_hook 调组件"; usageRules 4 条 cross-cutting 约束 | keywords: build-init-tip-tool, top-level-tool, discovery-chains, hook-fence-format, web-component-hook, usage-rules, history-chain

### tools/call-hook.tools.ts
LLM Hook 工具集 (5 个 tool 全部 target 路由, 闭包注入 invocationContext)

- `buildCallHookTool(hookBus, hookRpc, getCtx, sideEffects?, options?)` — 同步批量调用 hook; description 内嵌 `<when_to_call>` / `<routing>` / `<payload>` / `<batching>` / `<errors>` / `<example>` 七段; target 默认 SaaS, hookName 前缀归一化; `options.defaultDebug` 节点级 debug 默认值; **错误 hint 统一指向 init_tip** :: hook-not-found / payload-schema-invalid / N 次连续失败都提示先调 init_tip 拿 discoveryChains, 再按链路走; ⚠ reasoning 强制字段已废除 — LLM 实测不填 (optional 跳过 / required 触发 langchain schema 层拒绝, server 看不到 log), 行为约束改由 init_tip 的 usageRules 承载 | keywords: call-hook-tool, sync, batch, target-routing, target-normalize, default-debug, error-hint-init-tip
- `buildCallHookAsyncTool(hookBus, hookRpc, getCtx, options?)` — 批量 fire-and-forget; target 默认 SaaS, hookName 前缀归一化; 仅触发不关心结果时使用, 默认走同步 call_hook | keywords: call-hook-async-tool, batch, target-normalize, default-debug
- `processOneCallAftermath(entry, reply, ctx, sideEffects?)` — per-call 失败 hint 注入 + 副作用回调 | keywords: aftermath, per-call
- `buildSearchHookTool(hookBus, hookRpc, getCtx)` — 按 tags / pluginName / isWeb 搜索 hook 注册表; isWeb=false(默认)排除 Web Component Hook, isWeb=true 只返回组件; 不传 isWeb 永远不会返回组件，避免搜索混淆 | keywords: search-hook-tool, discovery, is-web-filter
- `buildGetHookTagTool(hookBus, hookRpc, getCtx)` — 获取 tag 频次榜; isWeb=false(默认)排除组件 tag, isWeb=true 只统计组件 tag | keywords: get-hook-tag-tool, tag-leaderboard, is-web-filter
- `buildGetHookInfoTool(hookBus, hookRpc, getCtx)` — 批量获取 hook 描述+tags+payload schema; 当 item 为 Web Component Hook (isComponent=true) 时额外注入 `_usage` 字段, 告知 LLM 输出 hook fence 并调 sendMsg, 不可用 call_hook 直接调用 | keywords: get-hook-info-tool, batch-info, component-usage-hint
- `dispatchOne(hookBus, hookRpc, ctx, input, defaultDebug)` — 内部统一路由 (saas/runner); debug 三层优先级 (input.debug ?? defaultDebug ?? false) | keywords: dispatch-one, debug-priority
- `dispatchSaasHook(hookBus, ctx, input)` — 适配 SaaS HookBus 结果到统一外形 | keywords: adapt-saas-result
- `normalizeHookCallInput(entry)` — 根据 `saas.*` / `runner.*` hookName 前缀归一化 target, 前缀优先于 target 字段 | keywords: normalize-hook-call-input, target-normalize
- `projectSaasRegistrations(regs)` — 把 SaaS Registry 投影成与 runner meta hook 同形列表 | keywords: project-saas-registrations
- `InvocationContextProvider` (type) — `() => HookInvocationContext` 闭包取值器 | keywords: invocation-context-provider

### prompts/base-llm.prompt.ts
基础 LLM 系统提示词

- `buildBaseLlmSystemPrompt()` — 生成 v5 JSON 基础 system prompt: `hardConstraints` (顶层硬约束: init_tip 每轮必须第一步 + sendMsg 唯一交付通道) + 第一人称 identity (`myNature` 第一条强化 init_tip 规则) + 3 正 2 反 examples (含纯聊天跳过 init_tip 的反例) + knowledgeCatalog 4 本 local 书 lazy load 入口 | keywords: base-llm-prompt, hard-constraints, init-tip-mandatory, example-driven, web-component-hook-fence, no-envelope
- `LlmSystemPromptJson` (type) — system prompt JSON 合同, 供基础提示与运行时 `role.{system,agentRuntime,proactiveDialogue,agentDefinition}` 注入共用; role 子字段统一第一人称 (myNature/myContext/myProactiveBehavior/myDefinitionBehavior) | keywords: system-prompt-json, role-json, prompt-contract, first-person-behavior

### types/agent-runtime.types.ts
- `LoadedAgent` — Agent 加载结果类型 (tools, dialogues, descriptor)
- `AgentDescriptor` — agent.desc.ts 解析结果; `{ name, description, supportDialogue, defaultDebug? }`; defaultDebug 节点级 call_hook debug 开关, 工厂闭包绑定整个 graph 流 | keywords: agent-descriptor, default-debug
