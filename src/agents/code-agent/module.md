# 模块名称 (Module Name)

code-agent（代码生成智能体）

## 概述 (Overview)

提供代码生成智能体的对话层和 code graph 工具入口。`code_gen_orchestrate` 现在是真实 LangGraph 工作流入口：先校验完整需求、Runner 指派、Runner 在线状态和会话上下文；如果缺少 `runner_id`，直接返回要求先获取 Runner 并完成指派的字符串；如果已指定 Runner，则先通过 `saas.app.runner.get` hook 确认 Runner 为 `mounted`，再生成稳定 thread id 并把 `StateGraph` + `TypeOrmCheckpointSaver` 放到后台执行，然后立即向 LLM 返回 `scheduled/resume_scheduled`。dependency-check 节点在后台验证 Runner Solution 列表 hook、读取已有 Solution 列表，并用逻辑模型把需求中已有的步骤/事项路由到 Solution 与 `app/unit/data-point` action，输出可包含多项的 `routePlan`。target-resolution 节点在 action 确认后读取对应 Solution 下的 app/unit/data-point 候选，再由逻辑模型判定每个具体目标是复用还是新建，输出 `targetPlan`。需要人工选择时通过 LangGraph `interrupt` 暂停，并由选择卡片提交后以 `Command({ resume })` 异步恢复同一个 graph thread。

## 文件清单 (File List)

- `agent.desc.ts` — Agent 名称、描述与对话能力声明。
- `agent.handle.ts` — AgentRuntime 注入点、工具导出与 LangGraph code graph 编排。
- `nodes/dependency-check.types.ts` — dependency-check 节点、graph 编排和选择卡片共享的类型与 hook 常量。
- `nodes/dependency-check.node.ts` — code graph 首个 dependency-check 节点主流程。
- `nodes/target-resolution.node.ts` — code graph 第二个 target-resolution 节点，读取 app/unit/data-point 候选并判定新建或复用。
- `nodes/dependency-check-log.ts` — code graph 节点日志读取、续写和类型守卫。
- `nodes/dependency-check-context.ts` — dependency-check 上下文字段、列表数据、动作和 Solution 选择读取。
- `nodes/dependency-check-runner-hooks.ts` — Runner Solution list hook 探测与 Solution 列表读取。
- `nodes/dependency-check-decision.ts` — dependency-check 的 LLM 判定、fallback、resume 选择和 runtime context 构造。
- `nodes/dependency-check-results.ts` — dependency-check graph 输出、等待/阻塞结果和工具回包文本构造。
- `nodes/dependency-choice-card.ts` — dependency-check 人工选择卡片 hook 消息与 payload 构造发送。
- `dialogues/dialogues.min.ts` — 需求澄清、风险反驳与开发确认对话层。
- `dialogues/types.ts` — 目标类型与 Runner-backed 目标选择合同。
- `module.contract.json` — 模块公开合同元数据。

## 函数清单 (Function List)

- `AgentDesc()` — 声明 code-agent 的名称、描述与是否支持对话 | keywords: code-agent, description
- `AgentHandleClass.handleAiServer(aiAdapter)` — 注入运行时 AI 适配器 | keywords: ai-injection, tool-runtime
- `AgentHandleClass.handleRunnerHookRpc(hookCaller)` — 注入最小 hook caller 接口，只通过 hook 协议访问 Runner | keywords: hook-caller, target-resolution
- `AgentHandleClass.handleHookBus(hookBus)` — 注入 SaaS HookBus，用于 code graph 启动前校验 Runner 在线状态 | keywords: hook-caller, runner-status
- `AgentHandleClass.withWorkflowContext(ctx)` — 注入 sessionId、agentId、agentPrincipalId 与模型槽位上下文 | keywords: workflow-context, session-callback
- `AgentHandleClass.handleCheckpointer(checkpointer)` — 注入 LangGraph checkpoint saver 以支持暂停恢复 | keywords: langgraph-checkpoint, workflow-resume
- `AgentHandleClass.handleTool()` — 导出 code-agent 工具列表 | keywords: tool-export, code-agent
- `AgentHandleClass.#buildOrchestrateTool()` — 构建 `code_gen_orchestrate` code graph 入口工具 | keywords: code-graph-tool, runner-assignment
- `normalizeCodeGraphRequirement(input)` — 从 `full_requirement` 或兼容字段 `requirement` 取完整需求 | keywords: full-requirement, tool-input
- `normalizeRunnerId(input)` — 从 `runner_id` 或兼容字段 `runnerId` 取 Runner 指派 | keywords: runner-assignment, tool-input
- `normalizeToolSessionId(context, workflowContext)` — 从工具 context 或运行时上下文取 `session_id` | keywords: session-callback, code-graph-context
- `buildCodeGraphRequest(fullRequirement, runnerId, context, sessionId)` — 组装未来 code graph 的标准请求信封 | keywords: code-graph-request, runner-assignment
- `withCodeGraphThreadId(request, threadId)` — 在异步启动前把稳定 graph thread id 写入请求上下文 | keywords: checkpoint-thread, async-workflow
- `launchCodeGenGraphInBackground(args)` — 后台触发 LangGraph 工作流并持久化最终结果 | keywords: async-workflow, background-run
- `buildCodeGraphAcceptedMessage(args)` — 构造 `code_gen_orchestrate` 立即返回给 LLM 的已接收回包 | keywords: tool-result, async-workflow
- `persistCodeGraphRunArtifact(args)` — 将 code graph 最终回包、节点日志和工具文本写入本地 JSON 运行产物，路由结果以 `result.context.routePlan` / `result.decision.routePlan` 为准 | keywords: artifact-log, code-graph-result
- `buildCodeGraphRunSummary(result, artifact)` — 生成 Nest logger 使用的 code graph 完成摘要 | keywords: artifact-log, result-summary
- `stringifyCodeGraphArtifact(value)` — 序列化 code graph 运行产物并兼容 JSON 不支持的值 | keywords: artifact-log, json-stringify
- `sanitizeLogPathPart(value)` — 将 session/run 字段转为安全文件名片段 | keywords: artifact-log, file-path
- `createCodeGraphNodeLogger(node, context)` — 创建可从 context 续写的节点日志器 | keywords: node-log, resume-log
- `extractCodeGraphLog(context)` — 从工具 context 读取上一轮 code graph 日志 | keywords: graph-log, resume-log
- `isCodeGraphLogEntry(value)` — 校验未知值是否为 graph log entry | keywords: graph-log, type-guard
- `runCodeGenGraph(args)` — 通过 LangGraph 运行 code graph 并处理 interrupt/checkpoint resume | keywords: langgraph-workflow, checkpoint-resume
- `buildCodeGenWorkflowGraph(args)` — 构建当前 code-agent LangGraph 工作流 | keywords: langgraph-workflow, target-resolution
- `buildCodeGraphRunnableConfig(args)` — 构造带 thread/workflow 元数据的 LangGraph runnable config | keywords: checkpoint-config, workflow-context
- `buildCodeGraphThreadId(request, workflowContext)` — 为一次代码生成请求生成独立 graph thread id | keywords: checkpoint-thread, code-graph-request
- `normalizeCodeGraphThreadId(threadId)` — 将外部传入的 graph thread id 归一化到 checkpoint schema 限制内 | keywords: checkpoint-thread, field-normalize
- `buildCodeGraphInvokeInput(args)` — 构造初始 graph 输入或 LangGraph resume command | keywords: checkpoint-resume, graph-input
- `buildDependencyResumeChoice(input)` — 将人工选择与 routePlan 归一化为 LangGraph resume value | keywords: dependency-selection, checkpoint-resume
- `readLangGraphCheckpointRef(snapshot, config)` — 从 LangGraph state snapshot 读取 thread/checkpoint/interrupt 引用 | keywords: checkpoint-read, langgraph-state
- `readSnapshotInterruptId(snapshot)` — 从 LangGraph state snapshot 读取首个 interrupt id | keywords: interrupt-read, langgraph-state
- `readCodeGenGraphDependencyCheck(output)` — 从 graph 输出读取 dependency-check 结果 | keywords: graph-output, dependency-check-node
- `buildWaitingDependencyCheckResultFromInterrupt(payload, log)` — 根据 LangGraph interrupt payload 构造等待选择回包 | keywords: interrupt-result, dependency-check-node
- `buildBlockedDependencyCheckResult(request, reason)` — 构造 graph 无法继续时的 blocked 回包 | keywords: tool-result, blocked-status
- `runDependencyCheckNode(args)` — 执行依赖检查节点，探测 Runner DB hooks、读取 Solution 并判定目标 | keywords: dependency-check-node, runner-db-hooks
- `runTargetResolutionNode(args)` — 执行具体目标判定节点，按已确认 action 判定 app/unit/data-point 新建或复用 | keywords: target-resolution, code-graph-node
- `buildTargetRouteInputs(args)` — 读取 routePlan 并列出每条路由的具体目标候选 | keywords: target-resolution, route-plan
- `readSelectedRouteSolution(route, dependencyCheck)` — 读取单条 route 已选择的既有或新建 Solution | keywords: target-selection, route-plan
- `isRunnerSolution(value)` — 判断目标判定中的 Solution 是否为既有 Runner Solution | keywords: solution-selection, type-guard
- `listConcreteTargets(args)` — 按 action 读取 app/unit/data-point 具体目标候选 | keywords: target-candidate, runner-db-hooks
- `normalizeTargetCandidate(action, value)` — 将 app/unit/data-point hook 行归一化为目标候选 | keywords: target-candidate, field-read
- `readStringArrayField(value, field)` — 从 hook 行读取字符串数组字段 | keywords: field-read, target-candidate
- `decideTargetResolution(args)` — 调用逻辑模型判定每条 route 的具体目标新建或复用 | keywords: target-resolution, dependency-decision
- `buildTargetResolutionPrompt(requirement, routes)` — 构造要求 LLM 输出具体目标判定 JSON 的提示 | keywords: target-resolution, json-output
- `normalizeLlmTargetResolution(payload, routes)` — 将 LLM 目标判定输出归一化为 graph targetPlan | keywords: target-resolution, route-plan
- `normalizeTargetRouteDecision(args)` — 归一化单条 route 的目标新建/复用判定 | keywords: target-resolution, target-selection
- `findPayloadRouteDecision(values, index, routeId)` — 按 route id 或位置匹配 LLM 返回的目标判定项 | keywords: field-read, target-resolution
- `resolveTargetCandidate(choice, candidates)` — 从候选 id 或名称解析被复用的具体目标 | keywords: target-selection, field-read
- `buildNewTargetOption(args)` — 为 create 判定构造新的 app/unit/data-point 目标候选 | keywords: target-create, fallback-decision
- `withTargetResolutionResult(dependencyCheck, result, log)` — 将 target-resolution 输出合并回 code graph 回包 | keywords: target-resolution, graph-output
- `buildBlockedTargetResolution(dependencyCheck, graphLog, reason)` — 构造 target-resolution blocked 回包 | keywords: target-resolution, blocked-status
- `buildSkippedTargetResolution(dependencyCheck, graphLog, reason)` — 构造 target-resolution skipped 回包 | keywords: target-resolution, graph-output
- `probeRunnerSolutionHooks(hookCaller, runnerId, workflowContext)` — 用 Runner meta hook 检查 Solution 数据库检索 hooks 是否存在 | keywords: hook-probe, runner-db-hooks
- `listRunnerSolutions(hookCaller, runnerId, workflowContext)` — 通过 Runner 本地 solution hook 列出 Solution | keywords: solution-list, runner-db-hooks
- `decideCodeGraphDependencies(args)` — 使用逻辑模型和确定性回退选择 Solution、动作与新 Solution 需求 | keywords: solution-selection, dependency-decision
- `selectLogicModel(aiAdapter, input)` — 选择 dependency-check 使用的逻辑模型客户端 | keywords: logic-model, dependency-decision
- `buildDependencyDecisionPrompt(requirement, targetKind, solutions)` — 构造要求 LLM 输出 JSON、只做 Solution/action 路由判定的提示 | keywords: dependency-decision, json-output
- `normalizeLlmDependencyDecision(payload, solutions, fallback, requirement)` — 将模型返回的选择、新 Solution 需求与 routePlan 映射到真实 Runner Solution | keywords: solution-selection, dependency-decision
- `normalizeActionList(values, fallback)` — 归一化并去重 dependency-check 的多动作集合 | keywords: action-selection, route-plan
- `normalizeRoutePlan(args)` — 归一化模型返回的 routePlan，并在缺失时生成默认路由计划 | keywords: route-plan, dependency-decision
- `normalizeRoutePlanItem(item, index, fallback)` — 归一化单个需求路由项 | keywords: route-plan, field-read
- `buildDefaultRoutePlan(args)` — 根据已知动作生成默认需求路由计划 | keywords: route-plan, fallback-decision
- `normalizeRuntimeRoutePlan(raw)` — 归一化运行上下文或卡片 payload 中的 routePlan | keywords: route-plan, field-read
- `normalizeRuntimeRoutePlanItem(item, index)` — 归一化单个运行时 routePlan 项 | keywords: route-plan, field-read
- `normalizeRuntimeRouteSolution(value)` — 归一化 routePlan 中携带的 Solution 选择 | keywords: route-plan, solution-selection
- `hasPendingRoutePlanSelection(decision)` — 判断 routePlan 是否仍有未确认的 Solution/action 指向 | keywords: route-plan, dependency-selection
- `readRoutePlanActions(routePlan)` — 从 routePlan 读取去重后的明确 action 集合 | keywords: route-plan, action-selection
- `readPrimaryRouteSolution(routePlan)` — 从 routePlan 读取第一个明确 Solution | keywords: route-plan, solution-selection
- `readPendingRouteSolutions(routePlan)` — 从未完成的 routePlan 项读取待选 Solution 集合 | keywords: route-plan, solution-selection
- `readPendingRouteActions(routePlan)` — 从未完成的 routePlan 项读取待选 action 集合 | keywords: route-plan, action-selection
- `readRouteString(value, field)` — 从 routePlan 记录读取字符串字段 | keywords: route-plan, field-read
- `normalizeDependencyNodeRequirement(input)` — 为 dependency-check fallback 命名归一化完整需求 | keywords: full-requirement, tool-input
- `buildFallbackDependencyDecision(input, targetKind, solutions)` — 构造 LLM 不可用时的人工确认回退 | keywords: solution-selection, fallback-decision
- `normalizeNewSolutionOption(raw, fallback, targetKind, reason)` — 归一化模型或 UI 返回的新 Solution 候选 | keywords: new-solution-option, dependency-decision
- `readOptionString(value, field)` — 从新 Solution 候选记录读取字符串字段 | keywords: new-solution-option, field-read
- `buildNewSolutionOption(args)` — 构造确认卡片中的默认新 Solution 候选 | keywords: new-solution-option, fallback-decision
- `getDecisionActions(decision)` — 从 dependency-check 判定结果读取最终动作集合 | keywords: action-selection, route-plan
- `buildDependencyRuntimeContext(decision)` — 从依赖判定结果生成 graph runtime context | keywords: graph-context, solution-selection
- `buildDependencyInterruptPayload(args)` — 构造 dependency-check 人工选择暂停的 LangGraph interrupt payload | keywords: interrupt-payload, selection-card
- `applyDependencyResumeChoice(args)` — 将 LangGraph resume 选择解析为真实 Runner solution/action/routePlan | keywords: dependency-selection, checkpoint-resume
- `sendDependencyChoiceCard(args)` — sends a dependency-choice hook component message through `saas.app.conversation.sendMsg` via the Runner hook bridge | keywords: selection-card-send, hook-component
- `buildDependencyChoiceCardContent(args)` — builds only the markdown hook fence for the dependency-choice component, without duplicate prose outside the card | keywords: hook-component-message, selection-card
- `buildDependencyChoiceCardPayload(args)` — builds the component payload from the dependency decision and graph context, including semantic localized `uiText` for card rendering | keywords: selection-card-payload, dependency-check
- `toDependencyChoiceCardRoute(route)` — projects one routePlan item into the compact card payload shape | keywords: route-plan, card-payload
- `toDependencyChoiceCardSolution(solution)` — projects a Runner solution summary into the compact card payload shape | keywords: solution-choice, card-payload
- `stringifyHookFencePayload(value)` — serializes hook fence JSON while escaping accidental markdown fence closure | keywords: hook-fence-json, json-stringify
- `assertForwardedSaaSHookDataOk(hookName, data)` — detects SaaS hook errors forwarded through the Runner `saas.*` bridge | keywords: saas-hook-forward, hook-error
- `checkRunnerMountedByHook(hookBus, runnerId, workflowContext)` — 通过 `saas.app.runner.get` hook 校验 Runner 必须处于 `mounted` 状态 | keywords: runner-status, runner-assignment
- `callSaasHookData(hookBus, hookName, payload, workflowContext)` — 调 SaaS hook 并解包单 handler 数据 | keywords: saas-hook-call, hook-data
- `callRunnerHookData(hookCaller, runnerId, hookName, payload, workflowContext)` — 调 Runner hook 并解包单 handler 数据 | keywords: runner-hook-call, hook-data
- `buildRunnerInvocationContext(workflowContext)` — 构造隐藏的 Runner RPC 调用上下文 | keywords: invocation-context, runner-hook
- `buildSaasInvocationContext(workflowContext)` — 构造隐藏的 SaaS hook 调用上下文 | keywords: invocation-context, saas-hook
- `assertRunnerHookReplyOk(hookName, reply)` — 将 Runner hook 软错误转为节点可读错误 | keywords: hook-error, runner-hook
- `readItems(value)` — 读取标准 hook `{ items }` 或数组数据 | keywords: hook-data, item-list
- `readStringField(value, field)` — 从未知记录读取字符串字段 | keywords: field-read, hook-data
- `toRunnerSolutionSummary(value, runnerId)` — 规范化 Runner Solution 摘要 | keywords: solution-summary, runner-db-hooks
- `findContextBoundSolution(context, solutions)` — 在 graph context 里优先解析已绑定的既有 Runner Solution | keywords: session-binding, solution-selection
- `isSolutionSuitableForAction(solution, action)` — 判断已绑定 Solution 是否声明支持指定 action | keywords: solution-fit, action-selection
- `findContextBoundAction(context)` — 从 graph context 解析已确认的 `chooseAction` / `targetKind` | keywords: action-selection, session-binding
- `readContextActionList(context, field)` — 从 graph context 读取并归一化动作数组 | keywords: graph-context, action-selection
- `readContextString(context, field)` — 从 graph context 读取字符串字段 | keywords: graph-context, field-read
- `readContextRecord(context, field)` — 从 graph context 读取对象字段 | keywords: graph-context, field-read
- `resolveSolutionChoice(choice, solutions)` — 将模型或入参中的 Solution 选择解析为真实 Solution | keywords: solution-selection, dependency-decision
- `normalizeActionChoice(value)` — 标准化 dependency-check 的目标动作 | keywords: action-selection, target-kind
- `parseJsonObjectLoose(raw)` — 宽松解析 LLM JSON 对象输出 | keywords: json-parse, dependency-decision
- `buildDependencyCheckResultMessage(request, result)` — 构造 dependency-check 工具回包 | keywords: tool-result, dependency-check-node
- `buildRunnerAssignmentRequiredMessage(sessionId)` — 构造缺少 `runner_id` 时的提示字符串 | keywords: runner-assignment, get-runner
- `inferToolTargetKind(input)` — 从工具入参推断粗目标类型, 页面/HTML 需求归入 app | keywords: infer-tool-target-kind, default-app-target
- `looksLikeFrontendAppRequirement(requirement)` — 判断需求是否更像前端 app 目标 | keywords: detect-frontend-app, default-app-target
- `DialoguesClass.handleAiServer(aiServer)` — 注入对话层 AI 适配器 | keywords: code-agent, dialogue, ai-injection
- `DialoguesClass.handlePluginService(pluginService)` — 注入对话层插件服务 | keywords: code-agent, dialogue, plugin-injection
- `DialoguesClass.handleSolutionService(solutionService)` — 注入对话层 SolutionService | keywords: solution-service, dialogue, target-resolution
- `DialoguesClass.setModelOverrides(opts)` — 显式覆盖逻辑/前端模型 | keywords: code-agent, dialogue, model-override
- `DialoguesClass.getPluginService()` — 返回当前插件服务实例 | keywords: code-agent, dialogue, plugin-service
- `DialoguesClass.getModelOverrides()` — 返回当前模型覆盖状态 | keywords: code-agent, dialogue, model-state
- `DialoguesClass.handle(messages)` — 使用对话模型处理需求澄清、风险反驳与开发确认 | keywords: code-agent, dialogue, ai-chat

## 关键词索引 (Keyword Index)

| 中文关键词       | English Keyword        |
| ---------------- | ---------------------- |
| 代码智能体       | code-agent             |
| 代码Graph工具    | code-graph-tool        |
| 代码Graph请求    | code-graph-request     |
| 代码Graph上下文  | code-graph-context     |
| LangGraph工作流  | langgraph-workflow     |
| LangGraph检查点  | langgraph-checkpoint   |
| 工作流恢复       | workflow-resume        |
| 检查点恢复       | checkpoint-resume      |
| 检查点配置       | checkpoint-config      |
| 检查点线程       | checkpoint-thread      |
| 字段归一化       | field-normalize        |
| Graph入参        | graph-input            |
| LangGraph状态    | langgraph-state        |
| Graph输出        | graph-output           |
| 异步工作流       | async-workflow         |
| 后台执行         | background-run         |
| 中断读取         | interrupt-read         |
| 中断payload      | interrupt-payload      |
| 中断回包         | interrupt-result       |
| 阻塞状态         | blocked-status         |
| 依赖检查节点     | dependency-check-node  |
| 代码Graph节点    | code-graph-node        |
| Runner数据库Hook | runner-db-hooks        |
| Hook调用接口     | hook-caller            |
| RunnerHook       | runner-hook            |
| RunnerHook调用   | runner-hook-call       |
| Runner状态       | runner-status          |
| 节点日志         | node-log               |
| Graph日志        | graph-log              |
| 运行产物日志     | artifact-log           |
| CodeGraph结果    | code-graph-result      |
| 结果摘要         | result-summary         |
| 文件路径         | file-path              |
| 暂停恢复日志     | resume-log             |
| Hook探测         | hook-probe             |
| 依赖判定         | dependency-decision    |
| JSON输出         | json-output            |
| 路由计划         | route-plan             |
| 目标判定         | target-resolution      |
| 目标选择         | target-selection       |
| 目标候选         | target-candidate       |
| 目标新建         | target-create          |
| 目标复用         | target-selection       |
| Solution选择     | solution-selection     |
| Solution适配     | solution-fit           |
| Solution摘要     | solution-summary       |
| 新Solution选项   | new-solution-option    |
| 依赖选择         | dependency-selection   |
| 选择卡片发送     | selection-card-send    |
| Hook组件         | hook-component         |
| Hook组件消息     | hook-component-message |
| 选择卡片         | selection-card         |
| 选择卡片payload  | selection-card-payload |
| 卡片payload      | card-payload           |
| 检查点读取       | checkpoint-read        |
| Hook组件JSON     | hook-fence-json        |
| SaaSHook转发     | saas-hook-forward      |
| SaaSHook调用     | saas-hook-call         |
| SaaSHook         | saas-hook              |
| 动作选择         | action-selection       |
| 目标类型         | target-kind            |
| Hook数据         | hook-data              |
| 完整需求         | full-requirement       |
| Runner指派       | runner-assignment      |
| 获取Runner       | get-runner             |
| 会话回传         | session-callback       |
| 工具入参         | tool-input             |
| 工具回包         | tool-result            |
| 工作流重构       | workflow-refactor      |
| 目标类型推断     | infer-tool-target-kind |
| 默认应用目标     | default-app-target     |
| 对话层           | dialogue               |

## 类型导出 (Type Exports)

- `WorkflowContext` — 记录工具调用时注入的 `sessionId`、`agentId`、`agentPrincipalId` 与 `aiModelIds` | keywords: workflow-context, session-callback
- `CodeAgentTargetKind` — 保留的粗目标类型 `app/unit/data-point`，不包含新建或初始化 Solution 动作 | keywords: target-kind, workflow-refactor
- `CodeAgentTargetSelection` — Runner-backed Solution/App 目标元数据，保留给后续节点兼容使用 | keywords: target-selection, runner-target
- `CodeGraphToolContext` — code graph 工具入参中的上下文块 | keywords: code-graph-context, session-callback
- `CodeGraphRequest` — 未来 code graph 执行前的标准请求信封 | keywords: code-graph-request, runner-assignment
- `HookCallReplyLike` — Runner hook caller 返回的软错误与结果形状 | keywords: runner-hook-call, hook-data
- `HookCaller` — dependency-check 节点调用 Runner hooks 的最小桥接接口 | keywords: hook-caller, runner-hook
- `CodeGenOrchestrateInput` — `code_gen_orchestrate` 工具兼容入参合同 | keywords: tool-input, langgraph-workflow
- `CodeGraphActionKind` — dependency-check 支持的目标动作 `app/unit/data-point` | keywords: action-selection, target-kind
- `CodeGraphLogLevel` — code graph 节点日志级别 | keywords: graph-log, node-log
- `RunnerSolutionSummary` — Runner Solution 列表项在 code graph 内部使用的摘要形状 | keywords: solution-summary, runner-db-hooks
- `CodeGraphNewSolutionOption` — 选择卡片里表示新建 Solution 的候选形状 | keywords: new-solution-option, dependency-decision
- `CodeGraphTargetDecisionKind` — 具体目标判定的 `reuse/create` 决策枚举 | keywords: target-selection, target-create
- `CodeGraphConcreteTargetSummary` — app、unit 或 data-point 候选目标的归一化摘要 | keywords: target-candidate, target-selection
- `CodeGraphNewTargetOption` — target-resolution 为后续节点提出的新建具体目标候选 | keywords: target-create, target-resolution
- `CodeGraphTargetRouteDecision` — 单条 route 的具体目标复用或新建判定 | keywords: target-resolution, route-plan
- `CodeGraphRequirementRoute` — dependency-check 对单个已有需求项的 Solution/action 路由形状 | keywords: route-plan, dependency-decision
- `CodeGraphDependencyDecision` — dependency-check 对 Solution、action routePlan 与新建需求的判定结果 | keywords: dependency-decision, solution-selection
- `LlmDependencyDecisionPayload` — 逻辑模型返回的 dependency-check JSON 判定载荷，支持 `useActions` 与 `routePlan` | keywords: dependency-decision, json-output
- `CodeGraphRuntimeContext` — dependency-check 与 target-resolution 写入后续节点的运行上下文，包含 `chooseActions`、`routePlan` 与 `targetPlan` | keywords: graph-context, solution-selection
- `CodeGraphResumeRef` — LangGraph 选择卡片恢复所需的 thread/checkpoint/interrupt 引用 | keywords: checkpoint-resume, langgraph-state
- `CodeGraphLogEntry` — code graph 节点日志条目形状 | keywords: graph-log, resume-log
- `CodeGraphNodeLogger` — dependency-check 节点追加结构化日志的 logger 接口 | keywords: node-log, resume-log
- `CodeGraphDependencyCheckResult` — dependency-check 节点的 ready/waiting/blocked 回包 | keywords: dependency-check-node, graph-output
- `CodeGraphTargetResolutionResult` — target-resolution 节点的 ready/skipped/blocked 回包 | keywords: target-resolution, graph-output
- `CodeGraphDependencyResumeChoice` — 选择卡片恢复为 LangGraph resume value 的选择形状 | keywords: dependency-selection, checkpoint-resume
- `CodeGraphDependencyInterruptPayload` — dependency-check 暂停并发送选择卡片的 interrupt payload | keywords: interrupt-payload, selection-card

## 模块功能描述 (Module Function Description)

`code_gen_orchestrate` 当前处理 Runner 指派、真实 LangGraph dependency-check 节点和 target-resolution 节点：

- 对话层系统提示要求生成、修改、初始化类任务不要在聊天回复里直接输出代码、HTML、CSS、JS、补丁或文件全文，只整理需求并启动 `code_gen_orchestrate`。

- 入参支持 `full_requirement`，并兼容旧字段 `requirement`。
- 入参支持 `runner_id`，并兼容旧字段 `runnerId`。
- 入参支持 `context.session_id`，若未传则回退到 AgentRuntime 注入的 `WorkflowContext.sessionId`。
- 入参支持 `resume.threadId/checkpointId/interruptId`，用于选择卡片提交后恢复 LangGraph checkpoint。
- 工具顶层不接受 `allowCreateSolution`、`solutionName`、`solutionVersion`、`solutionSummary` 等创建或命名 Solution 的字段；Solution 只能来自 Runner 已有记录或 graph context 已绑定选择。
- `targetKind` 与选择卡片 action 只允许 `app/unit/data-point`；`solution` 不是 code-agent 可执行动作；dependency-check 不负责拆代码目标，只在需求本身已经明确包含多步/多项时生成多个 `routePlan[]` 项；入口推断出的 `targetKind` 只作为默认提示，LLM 不可用时 fallback 会等待 action 确认，不直接硬判定。
- `runner_id` 缺失时，不启动 graph，直接返回要求先获取 Runner 并完成指派的字符串。
- `runner_id` 存在时，先通过 SaaS hook `saas.app.runner.get` 校验 Runner 当前 `status === "mounted"`；未查到、离线或校验失败时直接返回阻断提示，不启动 graph。
- Runner 在线校验通过后，`code_gen_orchestrate` 生成稳定 thread id，后台触发 `StateGraph` + `TypeOrmCheckpointSaver`，并立即向 LLM 返回 `scheduled/resume_scheduled`，不等待 dependency-check 完成。
- graph thread id 优先复用并归一化 `context.codeGraphThreadId/threadId`，否则为本次调用生成短 thread（`code-agent:<hash>:<nonce>`），避免超过 checkpoint 表 `thread_id` 长度限制；选择卡片会携带真实 `threadId/checkpointId/interruptId`。
- dependency-check 从 `context.code_graph_log` / `context.codeGraphLog` 继承已有日志，并把每一步 append 到同一条日志链。
- dependency-check 会调用 `runner.system.hookbus.getInfo` 检查 `runner.app.solution.list` 是否存在。
- hooks 满足后调用 `runner.app.solution.list` 获取 Runner 数据库里的 Solution 摘要，并交给逻辑模型返回 JSON 决策；决策包含兼容字段 `useAction`，以及多动作字段 `useActions`、`routePlan`。
- dependency-check 不读取 app/unit/data-point 关联列表，不解析具体对象 id/name，不做依赖分析；这些工作由 target-resolution 在 Solution/action 确认后处理。
- target-resolution 只在 dependency-check `ready` 后运行；它按已确认的 `route.useAction` 调用 `runner.app.solution.listApps`、`runner.app.solution.listUnits` 或 `runner.app.dataTouchpoint.list` 读取候选目标，不重新硬判定 action。
- target-resolution 把完整需求、routePlan、已选 Solution 和候选 app/unit/data-point 交给逻辑模型，要求输出严格 JSON `targetPlan[]`，每项只能是 `decision="reuse"` 并引用真实候选，或 `decision="create"` 并给出 `newTarget`。
- target-resolution 遇到新建 Solution 时不会读取候选，仍交给逻辑模型在空候选下产出具体目标的新建选项；LLM 不可用、返回非 JSON 或引用不存在的候选时返回 `blocked`，不做确定性硬判定。
- 即使 Runner 只返回一个 Solution，dependency-check 也不再确定性自动复用；逻辑模型必须判断该 Solution 是否适合当前需求，必要时返回 `requiresNewSolution/newSolutionOption/newSolutionReason`。
- LLM 决策不可用或返回非 JSON 时，fallback 会暂停并要求用户显式确认复用已有 Solution，同时给出 `newSolutionOption`；不会因为只有一个候选就直接 `ready`。
- 用户在确认卡片选择 `newSolutionOption` 后，dependency-check 会以 `ready + requiresNewSolution` 结束，把新 Solution 候选留给后续创建节点消费。
- 如果 session 已绑定 Solution 且该 Solution 的 `includes` 声明支持目标动作，dependency-check 可直接复用；绑定但明显不适配时仍进入复用/新建判断。
- 决策结果以 `routePlan` 为必要主数据；`chooseSolution`、`chooseAction`、`chooseActions` 只作为后续兼容字段从 routePlan 派生。
- 如果某个 `routePlan` 项的 Solution/action 指向仍不明确，dependency-check 节点调用 LangGraph `interrupt(payload)` 暂停；后台任务读取 state snapshot 后通过 `saas.app.conversation.sendMsg` 主动发送只包含 `saas.app.conversation.codeAgentDependencyChoice` hook fence 的消息；卡片 payload 携带按需求语种生成的 `uiText`，由组件自身说明选择含义，并把 `waiting_for_selection`、候选项与当前 `code_graph_log` 写入运行产物日志。
- 选择卡片提交到 `saas.app.conversation.codeAgentChoiceSubmit` 后，SaaS 侧重新加载 code-agent 工具并传入 `Command({ resume })`，异步恢复同一个 LangGraph thread；恢复值必须携带已确认的 `routePlan`，兼容字段从 routePlan 派生。
- 任意 hook/节点异常都会返回 `blocked` 并写入 `code_graph_log`，避免日志断裂。
- 每次后台 graph 完成或暂停后，都会把 dependency-check/target-resolution 最终回包、节点日志和最终节点回包文本写入 `logs/code-agent/<session_id>/...json`；也可用 `CODE_AGENT_LOG_DIR` 覆盖目录。
- 当前阶段不写 Runner 文件、不真实创建 Solution/app/unit/data-point、不执行真实代码生成节点；后续重构会在 `targetPlan` 之后接入创建/生成/编辑节点。
