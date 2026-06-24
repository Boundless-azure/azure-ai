# 模块名称 (Module Name)

code-agent（代码生成智能体）

## 概述 (Overview)

提供代码生成智能体的对话层和 code graph 工具入口。`code_gen_orchestrate` 现在是真实 LangGraph 工作流入口：先校验完整需求、Runner 指派和会话上下文；如果缺少 `runner_id`，直接返回要求先获取 Runner 并完成指派的字符串；如果已指定 Runner，则用 `TypeOrmCheckpointSaver` 编译并执行 dependency-check 节点，验证 Runner Solution 数据库检索 hooks、读取 Solution 列表，并用逻辑模型选择 Solution 与目标动作。需要人工选择时通过 LangGraph `interrupt` 暂停，并由选择卡片提交后以 `Command({ resume })` 恢复同一个 graph thread。

## 文件清单 (File List)

- `agent.desc.ts` — Agent 名称、描述与对话能力声明。
- `agent.handle.ts` — AgentRuntime 注入点、工具导出与 LangGraph code graph 工作流。
- `dialogues/dialogues.min.ts` — 需求澄清、风险反驳与开发确认对话层。
- `dialogues/types.ts` — 目标类型与 Runner-backed 目标选择合同。
- `module.contract.json` — 模块公开合同元数据。

## 函数清单 (Function List)

- `AgentDesc()` — 声明 code-agent 的名称、描述与是否支持对话 | keywords: code-agent, description
- `AgentHandleClass.handleAiServer(aiAdapter)` — 注入运行时 AI 适配器 | keywords: ai-injection, tool-runtime
- `AgentHandleClass.handleRunnerHookRpc(hookCaller)` — 注入最小 hook caller 接口，只通过 hook 协议访问 Runner | keywords: hook-caller, target-resolution
- `AgentHandleClass.withWorkflowContext(ctx)` — 注入 sessionId、agentId、agentPrincipalId 与模型槽位上下文 | keywords: workflow-context, session-callback
- `AgentHandleClass.handleCheckpointer(checkpointer)` — 注入 LangGraph checkpoint saver 以支持暂停恢复 | keywords: langgraph-checkpoint, workflow-resume
- `AgentHandleClass.handleTool()` — 导出 code-agent 工具列表 | keywords: tool-export, code-agent
- `AgentHandleClass.#buildOrchestrateTool()` — 构建 `code_gen_orchestrate` code graph 入口工具 | keywords: code-graph-tool, runner-assignment
- `normalizeCodeGraphRequirement(input)` — 从 `full_requirement` 或兼容字段 `requirement` 取完整需求 | keywords: full-requirement, tool-input
- `normalizeRunnerId(input)` — 从 `runner_id` 或兼容字段 `runnerId` 取 Runner 指派 | keywords: runner-assignment, tool-input
- `normalizeToolSessionId(context, workflowContext)` — 从工具 context 或运行时上下文取 `session_id` | keywords: session-callback, code-graph-context
- `buildCodeGraphRequest(fullRequirement, runnerId, context, sessionId)` — 组装未来 code graph 的标准请求信封 | keywords: code-graph-request, runner-assignment
- `createCodeGraphNodeLogger(node, context)` — 创建可从 context 续写的节点日志器 | keywords: node-log, resume-log
- `extractCodeGraphLog(context)` — 从工具 context 读取上一轮 code graph 日志 | keywords: graph-log, resume-log
- `isCodeGraphLogEntry(value)` — 校验未知值是否为 graph log entry | keywords: graph-log, type-guard
- `runCodeGenGraph(args)` — 通过 LangGraph 运行 code graph 并处理 interrupt/checkpoint resume | keywords: langgraph-workflow, checkpoint-resume
- `buildCodeGenWorkflowGraph(args)` — 构建当前 code-agent LangGraph 工作流 | keywords: langgraph-workflow, dependency-check-node
- `buildCodeGraphRunnableConfig(args)` — 构造带 thread/workflow 元数据的 LangGraph runnable config | keywords: checkpoint-config, workflow-context
- `buildCodeGraphThreadId(request, workflowContext)` — 为一次代码生成请求生成独立 graph thread id | keywords: checkpoint-thread, code-graph-request
- `normalizeCodeGraphThreadId(threadId)` — 将外部传入的 graph thread id 归一化到 checkpoint schema 限制内 | keywords: checkpoint-thread, field-normalize
- `buildCodeGraphInvokeInput(args)` — 构造初始 graph 输入或 LangGraph resume command | keywords: checkpoint-resume, graph-input
- `buildDependencyResumeChoice(input)` — 将人工选择归一化为 LangGraph resume value | keywords: dependency-selection, checkpoint-resume
- `readLangGraphCheckpointRef(snapshot, config)` — 从 LangGraph state snapshot 读取 thread/checkpoint/interrupt 引用 | keywords: checkpoint-read, langgraph-state
- `readSnapshotInterruptId(snapshot)` — 从 LangGraph state snapshot 读取首个 interrupt id | keywords: interrupt-read, langgraph-state
- `readCodeGenGraphDependencyCheck(output)` — 从 graph 输出读取 dependency-check 结果 | keywords: graph-output, dependency-check-node
- `buildWaitingDependencyCheckResultFromInterrupt(payload, log)` — 根据 LangGraph interrupt payload 构造等待选择回包 | keywords: interrupt-result, dependency-check-node
- `buildBlockedDependencyCheckResult(request, reason)` — 构造 graph 无法继续时的 blocked 回包 | keywords: tool-result, blocked-status
- `runDependencyCheckNode(args)` — 执行依赖检查节点，探测 Runner DB hooks、读取 Solution 并判定目标 | keywords: dependency-check-node, runner-db-hooks
- `probeRunnerSolutionHooks(hookCaller, runnerId, workflowContext)` — 用 Runner meta hook 检查 Solution 数据库检索 hooks 是否存在 | keywords: hook-probe, runner-db-hooks
- `listRunnerSolutions(hookCaller, runnerId, workflowContext)` — 通过 Runner 本地 solution hook 列出 Solution | keywords: solution-list, runner-db-hooks
- `decideCodeGraphDependencies(args)` — 使用逻辑模型和确定性回退选择 Solution 与目标动作 | keywords: target-selection, dependency-decision
- `selectLogicModel(aiAdapter, input)` — 选择 dependency-check 使用的逻辑模型客户端 | keywords: logic-model, dependency-decision
- `buildDependencyDecisionPrompt(requirement, targetKind, solutions)` — 构造要求 LLM 输出 JSON 的依赖判定提示 | keywords: dependency-decision, json-output
- `normalizeLlmDependencyDecision(payload, solutions, fallback)` — 将模型返回的选择映射到真实 Runner Solution | keywords: target-selection, dependency-decision
- `buildFallbackDependencyDecision(input, targetKind, solutions)` — 构造 LLM 不可用时的目标选择回退 | keywords: target-selection, fallback-decision
- `buildDependencyRuntimeContext(decision)` — 从依赖判定结果生成 graph runtime context | keywords: graph-context, target-selection
- `buildDependencyInterruptPayload(args)` — 构造 dependency-check 人工选择暂停的 LangGraph interrupt payload | keywords: interrupt-payload, selection-card
- `applyDependencyResumeChoice(args)` — 将 LangGraph resume 选择解析为真实 Runner solution/action | keywords: dependency-selection, checkpoint-resume
- `listSelectedSolutionActions(args)` — 在选定 Solution 与动作后列出关联 App 或 Unit | keywords: app-unit-list, runner-db-hooks
- `sendDependencyChoiceCard(args)` — sends a dependency-choice hook component message through `saas.app.conversation.sendMsg` via the Runner hook bridge | keywords: selection-card-send, hook-component
- `buildDependencyChoiceCardContent(args)` — builds the markdown hook fence for the dependency-choice component | keywords: hook-component-message, selection-card
- `buildDependencyChoiceCardPayload(args)` — builds the component payload from the dependency decision and graph context | keywords: selection-card-payload, dependency-check
- `toDependencyChoiceCardSolution(solution)` — projects a Runner solution summary into the compact card payload shape | keywords: solution-choice, card-payload
- `stringifyHookFencePayload(value)` — serializes hook fence JSON while escaping accidental markdown fence closure | keywords: hook-fence-json, json-stringify
- `assertForwardedSaaSHookDataOk(hookName, data)` — detects SaaS hook errors forwarded through the Runner `saas.*` bridge | keywords: saas-hook-forward, hook-error
- `callRunnerHookData(hookCaller, runnerId, hookName, payload, workflowContext)` — 调 Runner hook 并解包单 handler 数据 | keywords: runner-hook-call, hook-data
- `buildRunnerInvocationContext(workflowContext)` — 构造隐藏的 Runner RPC 调用上下文 | keywords: invocation-context, runner-hook
- `assertRunnerHookReplyOk(hookName, reply)` — 将 Runner hook 软错误转为节点可读错误 | keywords: hook-error, runner-hook
- `readItems(value)` — 读取标准 hook `{ items }` 或数组数据 | keywords: hook-data, item-list
- `readStringField(value, field)` — 从未知记录读取字符串字段 | keywords: field-read, hook-data
- `toRunnerSolutionSummary(value, runnerId)` — 规范化 Runner Solution 摘要 | keywords: solution-summary, runner-db-hooks
- `findContextBoundSolution(context, input, solutions)` — 在工具或会话上下文里优先解析已绑定 Solution | keywords: session-binding, solution-selection
- `findContextBoundAction(context, input, targetKind)` — resolves `chooseAction` / `targetKind` from graph context or tool input | keywords: action-selection, session-binding
- `readContextString(context, field)` — 从 graph context 读取字符串字段 | keywords: graph-context, field-read
- `readContextRecord(context, field)` — 从 graph context 读取对象字段 | keywords: graph-context, field-read
- `resolveSolutionChoice(choice, solutions)` — 将模型或入参中的 Solution 选择解析为真实 Solution | keywords: solution-selection, target-selection
- `findExplicitSolution(input, solutions)` — 解析工具入参里显式指定的 Solution | keywords: solution-selection, tool-input
- `normalizeActionChoice(value)` — 标准化 dependency-check 的目标动作 | keywords: action-selection, target-kind
- `parseJsonObjectLoose(raw)` — 宽松解析 LLM JSON 对象输出 | keywords: json-parse, dependency-decision
- `buildDependencyCheckResultMessage(request, result)` — 构造 dependency-check 工具回包 | keywords: tool-result, dependency-check-node
- `buildRunnerAssignmentRequiredMessage(sessionId)` — 构造缺少 `runner_id` 时的提示字符串 | keywords: runner-assignment, get-runner
- `inferToolTargetKind(input)` — 从工具入参推断粗目标类型 | keywords: infer-tool-target-kind, default-view-target
- `looksLikeLightweightViewRequirement(requirement)` — 判断需求是否更像轻量 view 目标 | keywords: detect-lightweight-view, default-view-target
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
| 中断读取         | interrupt-read         |
| 中断payload      | interrupt-payload      |
| 中断回包         | interrupt-result       |
| 阻塞状态         | blocked-status         |
| 依赖检查节点     | dependency-check-node  |
| Runner数据库Hook | runner-db-hooks        |
| Hook调用接口     | hook-caller            |
| 节点日志         | node-log               |
| Graph日志        | graph-log              |
| 暂停恢复日志     | resume-log             |
| Hook探测         | hook-probe             |
| 依赖判定         | dependency-decision    |
| 目标选择         | target-selection       |
| Solution选择     | solution-selection     |
| 依赖选择         | dependency-selection   |
| 应用单元列表     | app-unit-list          |
| 选择卡片发送     | selection-card-send    |
| Hook组件         | hook-component         |
| Hook组件消息     | hook-component-message |
| 选择卡片         | selection-card         |
| 选择卡片payload  | selection-card-payload |
| 卡片payload      | card-payload           |
| 检查点读取       | checkpoint-read        |
| Hook组件JSON     | hook-fence-json        |
| SaaSHook转发     | saas-hook-forward      |
| 动作选择         | action-selection       |
| Hook数据         | hook-data              |
| 完整需求         | full-requirement       |
| Runner指派       | runner-assignment      |
| 获取Runner       | get-runner             |
| 会话回传         | session-callback       |
| 工具入参         | tool-input             |
| 工具回包         | tool-result            |
| 工作流重构       | workflow-refactor      |
| 目标类型推断     | infer-tool-target-kind |
| 默认View         | default-view-target    |
| 对话层           | dialogue               |

## 类型导出 (Type Exports)

- `WorkflowContext` — 记录工具调用时注入的 `sessionId`、`agentId`、`agentPrincipalId` 与 `aiModelIds` | keywords: workflow-context, session-callback
- `CodeAgentTargetKind` — 保留的粗目标类型 `solution/app/view/unit` | keywords: target-kind, workflow-refactor
- `CodeAgentTargetSelection` — Runner-backed Solution/App 目标元数据 | keywords: target-selection, runner-target
- `CodeGraphToolContext` — code graph 工具入参中的上下文块 | keywords: code-graph-context, session-callback
- `CodeGraphRequest` — 未来 code graph 执行前的标准请求信封 | keywords: code-graph-request, runner-assignment

## 模块功能描述 (Module Function Description)

`code_gen_orchestrate` 当前处理 Runner 指派和真实 LangGraph dependency-check 节点：

- 入参支持 `full_requirement`，并兼容旧字段 `requirement`。
- 入参支持 `runner_id`，并兼容旧字段 `runnerId`。
- 入参支持 `context.session_id`，若未传则回退到 AgentRuntime 注入的 `WorkflowContext.sessionId`。
- 入参支持 `resume.threadId/checkpointId/interruptId`，用于选择卡片提交后恢复 LangGraph checkpoint。
- `runner_id` 缺失时，不启动 graph，直接返回要求先获取 Runner 并完成指派的字符串。
- `runner_id` 存在时，先打印完整需求日志，再通过 `StateGraph` + `TypeOrmCheckpointSaver` 执行 dependency-check 节点。
- graph thread id 优先复用并归一化 `context.codeGraphThreadId/threadId`，否则为本次调用生成短 thread（`code-agent:<hash>:<nonce>`），避免超过 checkpoint 表 `thread_id` 长度限制；选择卡片会携带真实 `threadId/checkpointId/interruptId`。
- dependency-check 从 `context.code_graph_log` / `context.codeGraphLog` 继承已有日志，并把每一步 append 到同一条日志链。
- dependency-check 会调用 `runner.system.hookbus.getInfo` 检查 `runner.app.solution.list/get/listApps/listUnits` 是否存在。
- hooks 满足后调用 `runner.app.solution.list` 获取 Runner 数据库里的 Solution 摘要，并交给逻辑模型返回 JSON 决策。
- 决策结果维护 graph context，`chooseSolution` 默认空字符串；自动选中后写入 `chooseSolution` 与 `chooseAction`。
- 如果需要用户选择 Solution 或 Action，dependency-check 节点调用 LangGraph `interrupt(payload)` 暂停；工具外层读取 state snapshot 后通过 `saas.app.conversation.sendMsg` 主动发送 `saas.app.conversation.codeAgentDependencyChoice` hook component，同时返回 `waiting_for_selection`、候选项与当前 `code_graph_log`。
- 选择卡片提交到 `saas.app.conversation.codeAgentChoiceSubmit` 后，SaaS 侧重新加载 code-agent 工具并传入 `Command({ resume })`，恢复同一个 LangGraph thread；恢复后的节点继续拉取 app/unit 关联列表。
- 已自动选中 Solution/Action 时，会继续按 action 调 `runner.app.solution.listApps` 或 `runner.app.solution.listUnits` 拉取关联列表。
- 任意 hook/节点异常都会返回 `blocked` 并写入 `code_graph_log`，避免日志断裂。
- 当前阶段不写 Runner 文件、不执行真实代码生成节点；后续重构会在 dependency-check 之后接入生成/编辑节点。
