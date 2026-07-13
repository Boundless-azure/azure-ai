# 模块名称 (Module Name)

code-agent（代码生成智能体）

## 概述 (Overview)

提供代码生成智能体的对话层和 code graph 工具入口。`code_gen_orchestrate` 现在是真实 LangGraph 工作流入口：先校验完整需求、Runner 指派、Runner 在线状态和会话上下文；如果缺少 `runner_id`，直接返回要求先获取 Runner 并完成指派的字符串；如果已指定 Runner，则先通过 `saas.app.runner.get` hook 确认 Runner 为 `mounted`，再生成稳定 thread id 并把 `StateGraph` + `TypeOrmCheckpointSaver` 放到后台执行，然后立即向 LLM 返回 `scheduled/resume_scheduled`。dependency-check 节点在后台验证 Runner Solution 列表 hook、读取已有 Solution 列表，并用逻辑模型把需求中已有的步骤/事项路由到 Solution 与 `app/unit/data-point` action，输出可包含多项的 `routePlan`。target-resolution 节点在 action 确认后读取对应 Solution 下的 app/unit/data-point 候选，再由逻辑模型判定每个具体目标是复用还是新建，输出 `targetPlan`。target-bootstrap 节点根据新建 Solution 或 app 的判定，用完整用户需求让逻辑模型生成简短名称、摘要、描述和 tags，并通过 Runner hook 完成初步元数据创建。change-plan 节点 (第四步, 支持 create 新建与 modify 就地修改) 在 target-bootstrap 后运行：用一个 code 驱动的 todo 状态机外循环 + 确定性验图自纠，规划整个 routePlan 要新增的文件与 hook 契约 (action tree)；变更集落在对应 Runner 的 Mongo (经 `runner.app.codeAgentPlan.*` 专有业务 hook)，不存 SaaS 内存，多租户物理隔离。需要人工选择时通过 LangGraph `interrupt` 暂停，并由选择卡片提交后以 `Command({ resume })` 异步恢复同一个 graph thread。

## 文件清单 (File List)

- `agent.desc.ts` — Agent 名称、描述与对话能力声明。
- `agent.handle.ts` — AgentRuntime 注入点、工具导出与 LangGraph code graph 编排。
- `nodes/dependency-check.types.ts` — dependency-check 节点、graph 编排和选择卡片共享的类型与 hook 常量。
- `nodes/dependency-check.node.ts` — code graph 首个 dependency-check 节点主流程。
- `nodes/target-resolution.node.ts` — code graph 第二个 target-resolution 节点，读取 app/unit/data-point 候选并判定新建或复用。
- `nodes/target-bootstrap.node.ts` — code graph 第三个 target-bootstrap 节点，生成简短元数据并确保 Solution/App 初始记录存在。
- `nodes/change-plan.node.ts` — code graph 第四个 change-plan 节点，todo 状态机外循环 + 验图自纠，规划要新增(create)/就地改(modify)的文件与 hook 契约 (action tree); 二次修改用 read_tags/search_by_tag 定位既有文件。
- `nodes/change-plan.types.ts` — change-plan 节点的 LLM 每轮动作 payload schema、todo 枚举、循环上限与存量 hook 摘要类型。
- `nodes/change-plan-store.ts` — change-plan 的 Runner 变更集存储客户端 (调 runner.app.codeAgentPlan.*) 与 scoped 存量 hook 搜索。
- `nodes/change-plan-knowledge.ts` — change-plan 的「先选书」: 按 routePlan 由 LLM 选用知识库书本 (调 saas.app.knowledge.search/getChapter) 并拼成生成手册。
- `nodes/build-generate.node.ts` — 构建子图三段: dispatch (按 topoOrder 派发+种 generate-file todo)、runGenerateFile (单文件工具循环)、finalizeBuild (汇聚产物)。
- `nodes/build-generate.types.ts` — 构建子图的 Send 派发载荷、单文件结果、校验结论、手册上限。
- `nodes/project-init.node.ts` — 初始化节点 (分 scaffold/deps 两 phase, 并行): scaffold 阶段跑 LLM 终端工具循环, 脚手架建结构 + **write_file 逐字写 tags.json** (强制 `--no-install` 不装依赖), 验 package.json **是合法 JSON** + 写 init.lock; deps 阶段 (runInstallDeps, 与 build 分支并行) 跑 `pnpm install` + 按 deps.add/remove 增删。**脚手架护栏**: create* 命令强制就地 (`.`), 否则拒跑并纠正 —— 拦随机名/嵌套子工程; 已建过拒二次。**禁 run_terminal echo/cat 手搓 package.json/config** (会被逐行转义写坏), 文件内容一律走 write_file。
- `nodes/build-test.node.ts` — 构建测试节点 (生成之后): LLM 工具循环 (run_terminal 跑 `npm run build`/read_file 看错误/add_repair_task 出返修) —— **判定一定是 LLM**, 没塞返修任务=构建通过; 返修任务进 changePlan.extraPlan, 打成 fix-mode BuildFileSend **复用 generate-file** 修; 超轮数还不过置 blocked。
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
- `launchCodeGenGraphInBackground(args)` — 后台触发 LangGraph 工作流、持久化最终结果, **并把完成/失败消息回发给对话** (经 sendDependencyNotice) —— 否则后台跑完只落产物+日志, 对话侧永远停"生成中" | keywords: async-workflow, background-run
- `buildCodeGraphCompletionMessage(result)` — 从终态结果拼面向用户的完成/失败消息 (ready=已生成N文件 / blocked=未完成+原因); waiting_for_selection 回 null(卡片已发过, 不重复) | keywords: completion-message, conversation-notify
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
- `buildCodeGraphRunnableConfig(args)` — 构造带 thread/workflow 元数据的 LangGraph runnable config；根 config 设 `callbacks: []` 一次性切断整棵 graph 树对主对话已关闭流式 writer 的继承 | keywords: checkpoint-config, workflow-context, isolate-callbacks
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
- `runTargetResolutionNode(args)` — 执行具体目标判定节点，按已确认 action 判定 app/unit/data-point 新建或复用；ready 时通过 `sendDependencyNotice` 把 app 层复用/新建告知发给用户 | keywords: target-resolution, code-graph-node
- `buildTargetRouteInputs(args)` — 读取 routePlan 并列出每条路由的具体目标候选 | keywords: target-resolution, route-plan
- `readSelectedRouteSolution(route, dependencyCheck)` — 读取单条 route 已选择的既有或新建 Solution | keywords: target-selection, route-plan
- `isRunnerSolution(value)` — 判断目标判定中的 Solution 是否为既有 Runner Solution | keywords: solution-selection, type-guard
- `listConcreteTargets(args)` — 按 action 读取 app/unit/data-point 具体目标候选 | keywords: target-candidate, runner-db-hooks
- `normalizeTargetCandidate(action, value)` — 将 app/unit/data-point hook 行归一化为目标候选 | keywords: target-candidate, field-read
- `readStringArrayField(value, field)` — 从 hook 行读取字符串数组字段 | keywords: field-read, target-candidate
- `decideTargetResolution(args)` — 逻辑模型**工具调用**判定每条 route 复用/新建 (`set_target_decision` 每 route 一条 + `set_notice`)，不再返回大 JSON、无 parse-fail；LLM 没产出则 code **全默认 create 兜底**(不出现"不判定")，reuse 幻觉由 `normalizeLlmTargetResolution` **降级 create** 兜；返回 `{ targetPlan, notice }` | keywords: target-resolution, tool-calling
- `buildTargetResolutionPrompt(requirement, routes)` — 构造复用/新建的**工具调用**提示 (指示 set_target_decision/set_notice)：优先复用既有候选、候选为空必须 create、reuse 只能照抄非空候选精确 id/name | keywords: target-resolution, tool-calling
- `normalizeLlmTargetResolution(payload, routes)` — 将 LLM 目标判定输出归一化为 graph targetPlan | keywords: target-resolution, route-plan
- `normalizeTargetRouteDecision(args)` — 归一化单条 route 的目标新建/复用判定；reuse 解析不到候选（候选为空硬判 reuse 或 id/name 对不上）时降级为 create，不再 blocked | keywords: target-resolution, target-selection
- `buildCreateRouteDecision(route, newTargetPayload, reason, downgraded)` — 构造 create 路由判定并合成新目标候选，供正常 create 与 reuse 降级共用；降级时 `downgraded=true` 打标 | keywords: target-create, target-resolution
- `findPayloadRouteDecision(values, index, routeId)` — 按 route id 或位置匹配 LLM 返回的目标判定项 | keywords: field-read, target-resolution
- `resolveTargetCandidate(choice, candidates)` — 从候选 id 或名称解析被复用的具体目标 | keywords: target-selection, field-read
- `buildNewTargetOption(args)` — 为 create 判定构造新的 app/unit/data-point 目标候选 | keywords: target-create, fallback-decision
- `withTargetResolutionResult(dependencyCheck, result, log)` — 将 target-resolution 输出合并回 code graph 回包 | keywords: target-resolution, graph-output
- `buildBlockedTargetResolution(dependencyCheck, graphLog, reason)` — 构造 target-resolution blocked 回包 | keywords: target-resolution, blocked-status
- `buildSkippedTargetResolution(dependencyCheck, graphLog, reason)` — 构造 target-resolution skipped 回包；跳过原因写 `reason`、`errors` 留空，避免监控误报 | keywords: target-resolution, graph-output
- `runTargetBootstrapNode(args)` — 根据新建 Solution/App 判定执行初始元数据创建节点 | keywords: target-bootstrap, code-graph-node
- `buildBootstrapRequests(dependencyCheck)` — 从 targetPlan 与新 Solution 判定中收集需要初步创建的对象 | keywords: target-bootstrap, target-create
- `readNewSolutionOption(dependencyCheck)` — 读取 dependency-check 或 targetPlan 里选中的新 Solution 候选 | keywords: target-bootstrap, new-solution-option
- `isNewSolutionOption(value)` — 判断未知值是否为新 Solution 候选 | keywords: new-solution-option, type-guard
- `generateBootstrapMetadata(args)` — 调用逻辑模型为 Solution/App 生成简短名称、描述和 tags | keywords: metadata-generation, target-bootstrap
- `buildBootstrapMetadataPrompt(requirement, requests)` — 构造初始创建元数据生成的严格 JSON 提示 | keywords: metadata-generation, json-output
- `ensureBootstrapTargets(args)` — 通过 Runner ensureTarget hook 确保 Solution/App 元数据存在；既有 Solution 摘要为占位/弱文案时用本次生成的 app 摘要回写 | keywords: target-bootstrap, runner-hook-call
- `isWeakBootstrapSummary(summary)` — 判断既有 Solution 摘要是否为占位/弱文案（空 / "Create or bind…" / "…managed by code-agent"），决定是否回写 | keywords: placeholder-summary, summary-writeback
- `buildEnsureTargetPayload(args)` — 从生成的元数据构造 `runner.app.solution.ensureTarget` payload | keywords: target-bootstrap, hook-data
- `callEnsureTargetHook(args)` — 调用 Runner `runner.app.solution.ensureTarget` hook | keywords: runner-hook-call, target-bootstrap
- `resolveBootstrapSolutionRef(args)` — 为 app 新建目标解析应挂载的 Solution 元数据 | keywords: target-bootstrap, solution-selection
- `isBootstrapRunnerSolution(value)` — 判断 bootstrap 中的 Solution 是否为既有 Runner Solution | keywords: solution-selection, type-guard
- `buildSolutionBootstrapEntry(args)` — 从 ensureTarget 返回值构造 Solution 初始创建记录 | keywords: target-bootstrap, graph-output
- `buildAppBootstrapEntry(args)` — 从 ensureTarget 返回值构造 app 初始创建记录 | keywords: target-bootstrap, graph-output
- `readEnsureRecord(data, field)` — 从 ensureTarget 未知返回值读取嵌套记录 | keywords: hook-data, field-read
- `normalizeBootstrapMetadata(raw, fallbackName)` — 归一化 LLM 生成的初始创建元数据 | keywords: metadata-generation, field-normalize
- `normalizeBootstrapName(name, fallbackName)` — 把生成名称归一化为短 kebab-case slug | keywords: field-normalize, metadata-generation
- `normalizeBootstrapTags(tags)` — 归一化 LLM 生成的 tags 列表 | keywords: field-normalize, metadata-generation
- `slugifyName(value)` — 把名称转换为稳定 ASCII slug | keywords: field-normalize, file-path
- `trimText(value, maxLength)` — 把生成文本裁剪为紧凑单行字符串 | keywords: field-normalize, metadata-generation
- `withTargetBootstrapResult(dependencyCheck, result, log)` — 将 target-bootstrap 输出合并回 code graph 回包; ready 时把创建的 solution/app 身份回写进 targetPlan.useTarget | keywords: target-bootstrap, graph-output
- `applyBootstrapToTargetPlan(targetPlan, entries)` — 把 bootstrap 建好的真实 solution/app name+id 回写进各 target 的 useTarget, 让下游按真 slug 拼路径 (修需求全文当 solution 名的 bug) | keywords: identity-writeback, target-plan
- `buildBlockedTargetBootstrap(dependencyCheck, graphLog, reason)` — 构造 target-bootstrap blocked 回包 | keywords: target-bootstrap, blocked-status
- `buildSkippedTargetBootstrap(dependencyCheck, graphLog, reason)` — 构造 target-bootstrap skipped 回包；跳过原因写 `reason`、`errors` 留空，避免监控误报 | keywords: target-bootstrap, graph-output
- `runChangePlanNode(args)` — 执行 change-plan 节点：code 驱动的 todo 外循环 + 验图自纠，规划要新增(create)/就地改(modify)的文件与 hook 契约; 既有目标先过 **analyze-target 分析闸门**(强制 record_analysis + 真检索代码, code 权威闭合后才 seed plan-target), 让 op:modify 规划有据 | keywords: change-plan, code-graph-node
- `dispatchBuildFiles(args)` — 构建派发: 按 topoOrder 排序、载入手册、种 generate-file todo、打包每文件 Send 载荷; **task.op=modify 时 Send 带 op:modify** (下游进 MODIFY 模式改既有文件) | keywords: build-dispatch, fan-out-prep
- `runGenerateFile(args)` — 单文件代码节点: **内存 todo 驱动**的完成循环。code 先 `seedFileTodos` 种"对应点"(要实现的内容/每条契约/hooks/@keyword注释/write_file), LLM 用 todo CRUD 工具边做边维护; 每轮一次真工具调用回复 (AI 层 createAgent 跑工具); **完成 = 文件真落盘且校验过 (ground truth) + 全部内存 todo 已 done**, 否则拼催办原因(文件侧问题 + 未完成 todo 逐项列出)下一轮"按 todo 完成"。`send.fix` 进 **FIX 模式**, `send.op==='modify'` 进 **MODIFY 模式**: 读现文件、优先 edit_file 定点改 | keywords: generate-file, todo-driven
- `buildFileNodeTools(args)` — 造该文件节点的可执行工具: write_file (全量写/create)、**edit_file (按 1-based 行号区间替换/modify; 行号唯一→无"子串不唯一")**、**read_file (带行号; 可传 startLine/endLine 只读窗口)**、**两层定位: search_by_tag (第一层搜注释: 按 @keyword tag 回文件+行号) → read_node (第二层读代码: 按 {path,line} 回该符号代码体+行号) → edit_file**、grep/fast_search[/get_hook_info]、注释 keyword 词表 list_keywords/search_keywords/add_keyword、**内存 todo 增删改查 todo_list/todo_add/todo_update/todo_remove** | keywords: file-node-tools, tool-binding
- `numberLines(text, start?)` — 给每行加行号前缀 (`<n>\t<line>`, 从 start 计数), read_file 窗口输出用 | keywords: number-lines, line-edit
- `deriveTargetRoot(path)` — 从 task 文件路径推目标根 (solutions/<sol>/apps|units|data/<name>), 给 search_by_tag 圈搜索范围 | keywords: derive-target-root, tag-search-scope
- `seedFileTodos(send)` — 按任务种单文件内存 todo 的"对应点": 修复/修改、实现内容、每条共享契约、hooks(unit)、@keyword 注释、write_file | keywords: seed-file-todos, checklist
- `openTodoTexts(todos)` — 列出未完成内存 todo 文本 (催办提示用) | keywords: seed-file-todos, checklist
- `safeUpsertTodo(store, planId, todo)` — 容错写 generate-file todo, 写失败不拖垮文件结果 | keywords: safe-upsert-todo, tolerant
- `validateGeneratedFile(send, content)` — 文件级校验 (完成②, todo 监督): 代码文件强制含项目格式 @keyword 注释, 缺则未完成 (Astro parse 规则后续) | keywords: file-validate, comment-supervision
- `requiresKeywordComments(path, content)` — 判该文件是否需 R5 @keyword 注释 (含函数/类/导出声明的代码文件要; 纯 css/json/svg/html/markup 免) | keywords: needs-comments, declaration-detect
- `runBuildVerify(args)` — 验证节点 (扇出后): 调 verifyTasks 按落盘真相查缺失, 缺文件排 repair (≤maxRepairRounds), verify 出错 fail-open 免死循环 | keywords: build-verify, repair-dispatch
- `verifyPlanFiles(args)` — 调 runner.app.codeAgentFs.verifyTasks 拿 present/missing (落盘真相) | keywords: verify-files, dangling-detect
- `collectAndSyncKeywords(args)` — 构建后调 collectKeywords 收全部文件 @keyword, 再逐 app ensureMany 同步进 tags.json (去重); best-effort | keywords: keyword-sync, vocab-backfill
- `decideInitTargets(args)` — change-plan 里判 app 目标: **init.lock ground-truth** 定 needsScaffold + **decideDependencies** 定依赖增删; 要脚手架或有依赖变更才入 initPlan | keywords: init-decision, init-lock
- `decideDependencies(args)` — change-plan 决定每个 app 要 add/remove 哪些 npm 依赖: **一轮工具循环** (read_file 看现有 package.json 已装啥 / search_files 找清单 / set_deps 逐 app 落决策), 而非一次性 JSON; 保持最小 | keywords: dependency-decision, dep-add-remove
- `buildDepsPrompt(candidates, finalTasks, requirement, manualText)` — 造依赖判定的**工具调用**提示 (逐 app 先按需 read_file 现有 package.json 再 set_deps, 不返回 JSON) | keywords: deps-prompt, tool-calling
- `runProjectInit(args)` — 初始化节点 (含 phase 参, 默认 scaffold): 逐 app 目标跑 LLM 终端工具循环。scaffold 阶段只建结构+tags.json (不装依赖)、验 package.json、写 init.lock; deps 阶段跑 install。汇成 changePlan.init; scaffold 有失败置 blocked | keywords: project-init-node, scaffold
- `runInstallDeps(args)` — install-deps 节点 (DEPS 阶段): 与 build 分支并行跑 `pnpm install` 装 node_modules; 薄封装 runProjectInit({phase:'deps'})。图节点绝不写 dependencyCheck (无 reducer/末写覆盖) 以免竞争 build 分支, 返 {} | keywords: install-deps-node, parallel-deps
- `initOneTarget(args)` — 单 app 目标初始化 (按 phase): 有界 LLM 工具循环 (run_terminal/write_file/read_file); scaffold 验 package.json 落盘且**是合法 JSON** (isScaffolded), deps 跑完即完成不校验 | keywords: init-one-target, tool-loop
- `buildInitTools(args)` — 造 init 工具集: **run_terminal** (跑命令/脚手架, 就地护栏)、**write_file** (逐字写非脚手架文本如 tags.json, 走 `runner.app.codeAgentFs.writeFile`, 根除 shell echo/cat 手搓被逐行转义写坏)、**read_file** (查 package.json/config) | keywords: init-tools, tool-binding
- `isScaffolded(planId, appDir, call)` — 脚手架校验: package.json 非空**且 JSON.parse 得过且是非空对象**才算真脚手架 —— 手搓被写坏的 package.json 非空但 parse 必炸→判未完成→重试, 不写 init.lock 锁死坏结构 | keywords: scaffold-verify, package-check
- `buildScaffoldPrompt(target, manual, miss)` — scaffold 阶段提示: 脚手架建结构+config, **tags.json 走 write_file (禁 run_terminal echo/cat 手搓 package.json/config → 会被逐行转义写坏)**, 强制 `--no-install`/不装依赖 (装依赖在并行的 deps 阶段) | keywords: scaffold-prompt, structure-only
- `buildDepsPrompt(target, manual, miss)` — deps 阶段提示: 结构已在, 只跑 install 装 node_modules + 按 deps.add/remove 增删, 不重建结构 | keywords: deps-prompt, install-deps
- `isScaffoldCommand(command)` — 识别 npm/pnpm/yarn/bun/npx create* 脚手架命令 (护栏用) | keywords: scaffold-command-detect, guardrail
- `commandIsInPlace(command)` — 命令是否就地 (含独立 `.` 目标 token); 脚手架护栏强制就地, 拦嵌套/随机名子工程 | keywords: in-place-check, current-dir
- `finalizeBuild(args)` — 构建汇聚: 按 verify 真相汇成 changePlan.build (buildResults 取每 taskId 最后一次); 仍有 missing 则置 blocked | keywords: build-join, build-summary
- `gateAfterScaffold(state)` — 条件边 (project-init/scaffold 后): **scaffold→并行边界**, 供成功 (status≠blocked) 则扇出到 `['install-deps','build-dispatch']` 两分支并行, 环境没搭好/plan 被 blocked 直接 END; build-test 后续扇入两分支 | keywords: scaffold-gate, phase-boundary
- `runBuildTest(args)` — 构建测试节点: LLM 工具循环跑 build + 判定返修 (add_repair_task→extraPlan), 打 fix-mode Send 复用 generate-file; 超轮数不过置 blocked。**判定权在 LLM**; **载入手册**(书里写"如何验证构建"流程) + 提示走最短路径(build 一次→看结果→干净就停) + 小 maxTokens(`buildTestMaxTokens`), 避免 reasoning 模型乱探索/想太久 | keywords: build-test-node, rework-judge
- `packFixSend(args)` — 把一个返修任务打成 fix-mode BuildFileSend (照抄 dispatch 的载荷形状 + fix.issue), 让 generate-file 原样处理 | keywords: pack-fix-send, reuse-generate
- `fanOutBuildTestRepair(state)` — 条件边 (build-test 后): 有返修文件则 Send 重触发 generate-file (FIX 模式, 回环 build-verify→build-join→build-test), 无返修/超预算 → END | keywords: rework-fan-out, build-rework
- `fanOutBuildFiles(state)` — 条件边: 每个已规划文件用 Send 扇出一个并发 generate-file 节点, 无文件直连 build-verify | keywords: build-fan-out, send-dispatch
- `fanOutRepairFiles(state)` — 条件边 (verify 后): 有缺失文件则 Send 重触发那些 generate-file (repair 轮), 否则落 build-join | keywords: repair-fan-out, dangling-retrigger
- `isModifiableTarget(target)` — 判目标是否可二次修改: `decision==='reuse' && !downgraded && useTarget` (复用即从 runner_apps 匹配到既有 app, 就有既有代码可 op:modify)。**不看 isInitialized** —— 那是"是否脚手架(init.lock)", 静态 view 页面永远 false 却有真实文件; 用它会漏判 | keywords: modifiable-target, create-or-modify
- `seedTargetTodos(store, planId, targetPlan, graphLog)` — 为每个 target 种起点 todo: 既有目标先种 **analyze-target**(强制分析闸门), 新目标直接 plan-target | keywords: seed-todos, plan-target
- `buildAnalysisPrompt(args)` — **分析闸门**那一轮的提示: 既有目标只做分析(拆需求成变更意图 + read_tags/search_by_tag 定位既有文件)并 record_analysis, 不规划文件 | keywords: analysis-prompt, requirement-code-analysis
- `buildChangePlanTools(deps)` — 组装 change-plan **工具集**: upsert_task(带 op:create/modify)/update_todo/grep/search_files/**read_tags**(读目标 tags.json 词表)/**search_by_tag**(内置 rg 按已声明 tag 反查关联文件+注释节点)/**record_analysis**(既有目标分析闸门落结论)/search_hooks/get_hook_info/**declare_contract·remove_contract**(维护跨文件文字契约数组: declare 增改 deps.contracts.upsert / remove 删 deps.contracts.delete)/set_notice; **不含 read_file** —— change-plan 只定位不读正文, 正文由 generate-file 自读; 检索类工具置 `shared.sawSearch`(分析闸门校验真检索过); LLM 逐个调用构建变更集 (**不再返回大 JSON**), 各工具直改 store/共享态 (foundExisting/contracts/analysis/notice) | keywords: change-plan-tools, tool-calling
- `runChangePlanRound(args)` — 跑一轮工具调用: LLM 用工具处理当前 open todos (createAgent 内部循环, 无 JSON 解析); 每轮完由 code 重算边 + 同步 resolve-edge todo | keywords: change-plan-round, tool-calling
- `computeEdges(tasks, foundExisting)` — 从所有任务推导 calls/compatibleWith 边并分类 new/existing/unresolved | keywords: edge-derive, edge-resolution
- `computeTopoOrder(tasks)` — 按任务级 dependsOn 派生叶子在前的拓扑生成顺序，回 { order, dangling(引用了不存在的 taskId), cyclic(成环任务补末尾) }，永不抛 | keywords: topo-order, dependency-order
- `syncResolveEdgeTodos(args)` — 按真实边状态同步 resolve-edge todo (code 权威自纠，不信 LLM 早退) | keywords: resolve-edge-sync, validation-self-correct
- `buildChangePlanPrompt(args)` — 构造 change-plan 单轮**工具调用**提示 (指示用工具构建, 非返回 JSON); 注入 targets(带 existing 标)/open todos/已规划任务/存量hook/已声明契约; **有既有目标时切到 create+modify 指引** (既有目标先 read_tags/search_by_tag 探查再 op:modify, 否则 create-only); contract-review 轮转 `buildContractReviewPrompt` | keywords: change-plan-prompt, tool-calling
- `buildContractReviewPrompt(args)` — **契约复盘门**那一轮的聚焦提示: 文件已规划完, LLM 唯一任务是复盘全量文件找跨文件共享符号 (锚点id/事件/形状) 并 declare_contract, 不再规划文件 | keywords: contract-review-prompt, coupling-contract
- `normalizeTurnTask(task, index)` — 将 LLM 任务输入归一化为变更任务; **op 取 LLM 的 create/modify (默认 create)**; **targetId/solutionId 取 ctx (code 权威, 复用即 useTarget.id) 优先于 LLM 自填** —— 否则 task.targetId=app名 与 initPlan.appId=完整id 对不上, project-init resolveAppDir 挂 | keywords: task-normalize, create-or-modify
- `edgeTodoId(edge)` — 从边派生稳定 resolve-edge todo id | keywords: edge-todo-id, field-normalize
- `slugifyPath(path)` — 把文件路径转成稳定 task id 片段 | keywords: path-slug, field-normalize
- `derivePlanId(request)` — 从稳定 code graph thread id 派生 planId | keywords: plan-id, checkpoint-thread
- `collectSolutionIds(targetPlan)` — 收集 targetPlan 引用的去重既有 solutionId | keywords: collect-solutions, change-plan
- `collectScopeNames(targetPlan)` — 收集用于 scope 存量 hook 搜索的候选 app/unit/target 名 | keywords: scope-names, existing-hook-search
- `withChangePlanResult(dependencyCheck, result, log)` — 将 change-plan 输出合并回 code graph 回包 | keywords: change-plan-result, graph-output
- `buildSkippedChangePlan(graphLog, reason)` — 构造 change-plan skipped 回包 | keywords: change-plan-skip, graph-output
- `buildBlockedChangePlan(graphLog, reason, planId)` — 构造 change-plan blocked 回包 | keywords: change-plan-blocked, blocked-status
- `buildTargetContext(targetPlan)` — 构造 routeId→{basePath,targetId,solutionId} 映射 | keywords: target-context, base-path
- `deriveTargetBasePath(target)` — 推导目标的 solution/app 相对基路径 (workspace 下) | keywords: base-path, target-path
- `toWorkspaceRelative(absPath)` — 把 Runner 绝对路径裁成 workspace 相对路径 | keywords: workspace-relative, path-normalize
- `joinTargetPath(base, file)` — 把模型给的目标内文件路径拼到基路径下 (防越界) | keywords: path-join, scope-fence
- `slimCodeGraphResultForArtifact(result)` — 持久化产物去重节点日志 (顶层只留一份) | keywords: artifact-slim, log-dedup
- `trimArtifactInput(input)` — 持久化产物剥掉 input 里重复的需求全文 | keywords: artifact-slim, input-trim
- `loadPlanningManuals(args)` — change-plan 先选书: 按 routePlan 选知识库书本并加载章节为生成手册 | keywords: select-load-books, manual-load
- `listCandidateBooks(hookBus, workflowContext)` — 经 saas.app.knowledge.search 列出 Agent 可见候选书本 | keywords: candidate-books, knowledge-list
- `pickBooks(args)` — 逻辑模型按 routePlan 选用书本, 失败回退前端 tag 书本 | keywords: pick-books, fallback-decision
- `buildBookPickPrompt(targetPlan, candidates)` — 构造选书严格 JSON 提示 | keywords: book-pick-prompt, json-output
- `loadChapters(hookBus, workflowContext, bookIds)` — 先 getToc 拿全部 chapterId 再 getChapter 取正文 (含详情章, 不止 LM必读), 按 bookIds 顺序限长拼接 | keywords: load-chapters, manual-assemble
- `collectChapterRecords(data, bookIds)` — 把 getToc/getChapter 的 Record<bookId,章节[]>/数组/{items} 展平为有序章节记录 | keywords: flatten-chapters, shape-tolerant
- `isRecord(value)` — 普通对象记录类型守卫 | keywords: record-guard, type-guard
- `callSaasHook(hookBus, hookName, payload, workflowContext)` — 经 SaaS HookBus 调知识 hook 并解包数据 | keywords: saas-hook-call, knowledge-read
- `buildManualPromptSection(manualText)` — 把手册拼成注入生成 prompt 的段落 | keywords: manual-section, prompt-inject
- `ChangePlanStore.ensurePlan(payload)` — 幂等创建/读取计划元数据 (调 runner.app.codeAgentPlan.ensurePlan) | keywords: ensure-plan, idempotent
- `ChangePlanStore.upsertTasks(planId, tasks)` — 批量 merge-upsert 变更任务 | keywords: upsert-tasks, partial-upsert
- `ChangePlanStore.searchTasks(planId, filter)` — 计划内局部搜索变更任务 | keywords: search-tasks, local-search
- `ChangePlanStore.upsertTodos(planId, todos)` — 批量 merge-upsert todo (新增与改状态共用) | keywords: upsert-todos, state-machine
- `ChangePlanStore.listTodos(planId, status?)` — 按状态列出 todo，驱动外循环 | keywords: list-todos, status-filter
- `ChangePlanStore.getSnapshot(planId)` — 读计划元数据 + 计数供完成判定 | keywords: plan-snapshot, completion-check
- `searchSolutionHooks(args)` — scope 到 routePlan solution 的存量 hook 搜索 (hookbus.search + getInfo) | keywords: existing-hook-search, edge-resolution
- `normalizeStoredTask(value)` — 把存储的变更任务行归一化为 graph 变更任务形状 | keywords: task-normalize, change-task
- `probeRunnerSolutionHooks(hookCaller, runnerId, workflowContext)` — 用 Runner meta hook 检查 Solution 数据库检索 hooks 是否存在 | keywords: hook-probe, runner-db-hooks
- `listRunnerSolutions(hookCaller, runnerId, workflowContext)` — 通过 Runner 本地 solution hook 列出 Solution | keywords: solution-list, runner-db-hooks
- `decideCodeGraphDependencies(args)` — 使用逻辑模型和确定性回退选择 Solution、动作与新 Solution 需求 | keywords: solution-selection, dependency-decision
- `requestDependencyDecision(args)` — 逻辑模型**工具调用**产路由判定 (set_route/propose_new_solution/set_notice 累积成 routePlan)，**不再返回大 JSON**、无 parse-fail 重试；产物过同一 `normalizeLlmDependencyDecision`（行为不变）；空则回 null 走 fallback | keywords: dependency-decision, tool-calling
- `compactRequirementForRouting(requirement, maxChars)` — 压缩超长需求，避免 reasoning 模型思考膨胀导致不产出 JSON | keywords: requirement-compact, dependency-decision
- `selectLogicModel(aiAdapter, input)` — 选择 dependency-check 使用的逻辑模型客户端 | keywords: logic-model, dependency-decision
- `buildDependencyDecisionPrompt(requirement, targetKind, solutions)` — 构造"先判定、能定就定"的 Solution/action 路由**工具调用**提示（指示 set_route/propose_new_solution/set_notice，非返回 JSON）：可复用即复用、能推断动作即提交，仅真正歧义才 waitChoose；决策规则原样保留 | keywords: dependency-decision, tool-calling
- `DecisionRouteInputSchema` / `DecisionNewSolutionInputSchema` / `DecisionSolutionRefSchema` — set_route/propose_new_solution 的工具入参 schema（替代旧 LlmDependencyDecisionSchema 大 JSON 校验器） | keywords: decision-tool-input, tool-calling
- `normalizeLlmDependencyDecision(payload, solutions, fallback, requirement)` — 将模型返回的选择、新 Solution 需求与 routePlan 映射到真实 Runner Solution | keywords: solution-selection, dependency-decision
- `normalizeActionList(values, fallback)` — 归一化并去重 dependency-check 的多动作集合 | keywords: action-selection, route-plan
- `normalizeRoutePlan(args)` — 归一化模型返回的 routePlan，并在缺失时生成默认路由计划 | keywords: route-plan, dependency-decision
- `normalizeRoutePlanItem(item, index, fallback)` — 归一化单个需求路由项；单候选 waitChoose/waitChooseAction 自动提交为 useSolution/useAction，不再挂起问答 | keywords: route-plan, field-read
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
- `buildFallbackDependencyDecision(input, targetKind, solutions)` — 构造 LLM 不可用时的回退：动作直接取 `targetKind` 提交，仅 Solution 留待人工确认 | keywords: solution-selection, fallback-decision
- `normalizeNewSolutionOption(raw, fallback, targetKind, reason)` — 归一化模型或 UI 返回的新 Solution 候选 | keywords: new-solution-option, dependency-decision
- `readOptionString(value, field)` — 从新 Solution 候选记录读取字符串字段 | keywords: new-solution-option, field-read
- `buildNewSolutionOption(args)` — 构造确认卡片中的默认新 Solution 候选 | keywords: new-solution-option, fallback-decision
- `getDecisionActions(decision)` — 从 dependency-check 判定结果读取最终动作集合 | keywords: action-selection, route-plan
- `buildDependencyRuntimeContext(decision)` — 从依赖判定结果生成 graph runtime context | keywords: graph-context, solution-selection
- `buildDependencyInterruptPayload(args)` — 构造 dependency-check 人工选择暂停的 LangGraph interrupt payload | keywords: interrupt-payload, selection-card
- `applyDependencyResumeChoice(args)` — 将 LangGraph resume 选择解析为真实 Runner solution/action/routePlan | keywords: dependency-selection, checkpoint-resume
- `sendDependencyChoiceCard(args)` — sends a dependency-choice hook component message through `saas.app.conversation.sendMsg` via the Runner hook bridge | keywords: selection-card-send, hook-component
- `sendDependencyNotice(args)` — 复用/新建 Solution 确定后向用户发一条纯文本告知（语言由 LLM 跟随需求生成），发送失败只 warn 不阻断 | keywords: reuse-notice, selection-card-send
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
- `parseJsonObjectLoose(raw)` — 宽松解析 LLM JSON 对象输出，先剥离思考块；**只认 object/array 结果**(标量如被引号包住的字符串继续走 fence/括号配平提取首个对象)，都不中时带原文片段抛错 | keywords: json-parse, dependency-decision
- `tryParseStructured(text)` — 尝试解析成结构化 JSON (object/array)，标量或失败返回 undefined | keywords: json-parse, structured-only
- `stripReasoningArtifacts(raw)` — 剥离 reasoning 模型在 JSON 外包裹的 `<think>` 等思考片段 | keywords: json-parse, reasoning-strip
- `extractFirstJsonObject(text)` — 用括号配平从夹带前后文的输出里提取第一个完整 JSON 对象 | keywords: json-parse, brace-balance
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
| 完成消息         | completion-message     |
| 回发对话         | conversation-notify    |
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
| JSON解析         | json-parse             |
| 模型重试         | llm-retry              |
| 需求压缩         | requirement-compact    |
| 思考剥离         | reasoning-strip        |
| 括号配平         | brace-balance          |
| 路由计划         | route-plan             |
| 目标判定         | target-resolution      |
| 初始创建         | target-bootstrap       |
| 目标选择         | target-selection       |
| 目标候选         | target-candidate       |
| 目标新建         | target-create          |
| 目标复用         | target-selection       |
| 元数据生成       | metadata-generation    |
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
| 变更集规划       | change-plan            |
| 变更集结果       | change-plan-result     |
| 变更集跳过       | change-plan-skip       |
| 变更集阻塞       | change-plan-blocked    |
| 变更集提示       | change-plan-prompt     |
| 变更集存储客户端 | change-plan-store-client |
| 变更任务         | change-task            |
| 种子文件todo     | seed-file-todos        |
| 完成清单         | checklist              |
| 任务归一化       | task-normalize         |
| 新增            | create-only            |
| 新建或修改       | create-or-modify       |
| 按标签反查       | search-by-tag          |
| 反查关联文件     | reverse-lookup         |
| 注释节点         | comment-node           |
| 可修改目标       | modifiable-target      |
| 分析闸门提示     | analysis-prompt        |
| 需求代码分析     | requirement-code-analysis |
| 分析结论         | analysis-finding       |
| 变更意图         | change-intent          |
| hook契约         | hook-contract          |
| 依赖边           | dependency-edge        |
| 边解析           | edge-resolution        |
| 边推导           | edge-derive            |
| 边todo同步       | resolve-edge-sync      |
| 验图自纠         | validation-self-correct |
| 存量hook搜索     | existing-hook-search   |
| 作用域名集       | scope-names            |
| 种子todo         | seed-todos             |
| 规划目标         | plan-target            |
| LLM动作          | llm-turn               |
| 应用动作         | apply-turn             |
| 搜索履行         | fulfill-search         |
| todo状态         | todo-status            |
| todo类型         | todo-type              |
| 状态机           | state-machine          |
| todo列表         | list-todos             |
| 状态过滤         | status-filter          |
| 任务批量写       | upsert-tasks           |
| todo批量写       | upsert-todos           |
| 任务搜索         | search-tasks           |
| 局部搜索         | local-search           |
| 局部更新         | partial-upsert         |
| 确保计划         | ensure-plan            |
| 计划快照         | plan-snapshot          |
| 完成判定         | completion-check       |
| 计划Id           | plan-id                |
| 路径slug         | path-slug              |
| 边todoId         | edge-todo-id           |
| Solution收集     | collect-solutions      |
| 循环上限         | loop-limit             |
| 目标上下文       | target-context         |
| 路径基址         | base-path              |
| 目标路径         | target-path            |
| 工作区相对       | workspace-relative     |
| 路径归一化       | path-normalize         |
| 路径拼接         | path-join              |
| 作用域围栏       | scope-fence            |
| 产物瘦身         | artifact-slim          |
| 日志去重         | log-dedup              |
| 入参裁剪         | input-trim             |
| 选书读书         | select-load-books      |
| 手册加载         | manual-load            |
| 候选书本         | candidate-books        |
| 知识列举         | knowledge-list         |
| 选书判定         | pick-books             |
| 选书提示         | book-pick-prompt       |
| 章节加载         | load-chapters          |
| 手册拼接         | manual-assemble        |
| 知识读取         | knowledge-read         |
| 手册段落         | manual-section         |
| 提示注入         | prompt-inject          |
| 章节展平         | flatten-chapters       |
| 形状兼容         | shape-tolerant         |
| 记录守卫         | record-guard           |
| SaaSHook总线     | saas-hook-bus          |
| 选用书本         | selected-books         |
| 手册文本         | manual-text            |

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
- `CodeGraphTargetRouteDecision` — 单条 route 的具体目标复用或新建判定；`downgraded` 标记 reuse→create 降级 | keywords: target-resolution, route-plan
- `CodeGraphBootstrapMetadata` — target-bootstrap 使用的简短名称、摘要、描述和 tags 元数据 | keywords: target-bootstrap, metadata-generation
- `CodeGraphBootstrapEntry` — 已通过 Runner hook 初步确保的 Solution/App 元数据记录 | keywords: target-bootstrap, target-create
- `CodeGraphRequirementRoute` — dependency-check 对单个已有需求项的 Solution/action 路由形状 | keywords: route-plan, dependency-decision
- `CodeGraphDependencyDecision` — dependency-check 对 Solution、action routePlan 与新建需求的判定结果；含 `notice` 面向用户的本地化告知文案 | keywords: dependency-decision, solution-selection
- `LlmDependencyDecisionPayload` — 逻辑模型返回的 dependency-check JSON 判定载荷，支持 `useActions` 与 `routePlan` | keywords: dependency-decision, json-output
- `CodeGraphRuntimeContext` — dependency-check 与 target-resolution 写入后续节点的运行上下文，包含 `chooseActions`、`routePlan` 与 `targetPlan` | keywords: graph-context, solution-selection
- `CodeGraphResumeRef` — LangGraph 选择卡片恢复所需的 thread/checkpoint/interrupt 引用 | keywords: checkpoint-resume, langgraph-state
- `CodeGraphLogEntry` — code graph 节点日志条目形状 | keywords: graph-log, resume-log
- `CodeGraphNodeLogger` — dependency-check 节点追加结构化日志的 logger 接口 | keywords: node-log, resume-log
- `CodeGraphDependencyCheckResult` — dependency-check 节点的 ready/waiting/blocked 回包 | keywords: dependency-check-node, graph-output
- `CodeGraphTargetResolutionResult` — target-resolution 节点的 ready/skipped/blocked 回包；含 `notice`（app 层复用/新建告知）与 `reason`（skipped 跳过原因，与 errors 区分） | keywords: target-resolution, graph-output
- `CodeGraphTargetBootstrapResult` — target-bootstrap 节点的 ready/skipped/blocked 回包；含 `reason`（skipped 跳过原因，与 errors 区分） | keywords: target-bootstrap, graph-output
- `CodeGraphDependencyResumeChoice` — 选择卡片恢复为 LangGraph resume value 的选择形状 | keywords: dependency-selection, checkpoint-resume
- `CodeGraphDependencyInterruptPayload` — dependency-check 暂停并发送选择卡片的 interrupt payload | keywords: interrupt-payload, selection-card
- `CodeGraphHookContract` — 单个 hook 契约 (名称 + 签名 + calls/compatibleWith 出边) | keywords: hook-contract, dependency-edge
- `CodeGraphChangeTask` — 变更任务 (`op`: create=新文件 / modify=就地改既有文件; `summary` 用途; `hooks` 仅 unit 目标有, app/data-point 为空; `dependsOn` 本 plan 内粗粒度兄弟 taskId 依赖, 供拓扑排序) | keywords: change-task, create-or-modify
- `CodeGraphChangePlanEdge` — 由 hook 契约派生的依赖边，按 new/existing/unresolved 分类 | keywords: dependency-edge, edge-resolution
- `CodeGraphChangePlanResult` — change-plan 节点回包 (changeTasks/edges/topoOrder/contracts/initPlan/build/openTodos/iterations) | keywords: change-plan-result, graph-output
- `CodeGraphInitTarget` — change-plan 判定的一个 app setup 目标 (appDir + needsScaffold + deps:{add,remove}), 附在 changePlan.initPlan | keywords: init-target, scaffold
- `CodeGraphInitSummary` — project-init 汇总 (total/ok/failed + 每 app 成败), 附在 changePlan.init | keywords: init-summary, scaffold-result
- `CodeGraphBuildSummary` / `CodeGraphBuildFile` — 构建子图产物汇总 (total/written/failed + 每文件结果), 附在 changePlan.build | keywords: build-summary, build-file
- `BuildFileSend` — dispatch 扇出给每个并发代码节点的 Send 载荷 (planId/runnerId/需求/手册/task/deps/**contracts**/**fix**); fix 存在=返修模式 (build-test 出) | keywords: build-file-send, send-payload
- `CodeGraphExtraTask` — 返修/扩展任务 (taskId/path/targetId/issue/origin); build-test 的 LLM 判定要修哪个文件+什么问题, 进 changePlan.extraPlan, 复用 generate-file 修 | keywords: extra-task, rework-task
- `CodeGraphBuildTestSummary` — build-test 汇总 (ok/rounds/pendingFixes/summary); 无返修任务=构建通过 | keywords: build-test-summary, rework
- `BuildFileResult` — 单文件生成结果 (written/failed/skipped + bytes/turns/validation) | keywords: build-file-result, file-artifact
- `BuildValidationResult` — 文件级校验结论 (rule/ok/issues; Astro 先行, 当前 none) | keywords: validation-result, pluggable-rule
- `CHANGE_PLAN_TODO_STATUS` / `ChangePlanTodoStatus` — todo 状态机枚举 | keywords: todo-status, state-machine
- `CHANGE_PLAN_TODO_TYPES` / `ChangePlanTodoType` — todo 类型枚举 (plan-target/resolve-edge/fix-validation/generate-file) | keywords: todo-type, planning-work-unit
- `CHANGE_PLAN_LIMITS` — code 驱动外循环与搜索的硬上限 | keywords: loop-limit, search-limit
- `ExistingHookSummary` — scoped 搜索命中的存量 hook 摘要 (名称+签名)，用于解析 new→existing 边 | keywords: existing-hook-summary, edge-resolution
- `ChangeTaskInputSchema` / `ChangePlanTaskInput` — `upsert_task` 工具入参 (`op` create/modify + 一个文件 + unit 的 hook 契约 + dependsOn); LLM 逐次调用构建, 非大 JSON | keywords: task-tool-input, change-task
- `RecordAnalysisInputSchema` / `RecordAnalysisInput` — `record_analysis` 工具入参 (routeId + findings[{intent, files, note}]); 既有目标分析闸门产物 | keywords: record-analysis-input, requirement-code-analysis
- `AnalysisFinding` — 一条分析结论 `{ intent, files, note? }`; 注入 plan-target 提示让 modify 规划有据 | keywords: analysis-finding, change-intent
- `ContractInputSchema` / `ContractInput` — `declare_contract` 工具入参 (contractId/name/description/spec/taskIds) | keywords: contract-tool-input, coupling-contract
- `CodeGraphContract` — 通用联动开发契约面 (contractId/name/description/spec/taskIds; LLM 协定的跨文件共享约定, 挂在 taskIds 上, 生成时注入参与节点), 前后端同构 | keywords: contract-surface, coupling-contract
- `SaasHookBusLike` — change-plan 读知识库所需的最小 SaaS HookBus 形状 | keywords: saas-hook-bus, knowledge-read
- `SelectedManuals` — 先选书选中的书本 id + 拼好的手册文本 + 面向用户的 notice | keywords: selected-books, manual-text

## 模块功能描述 (Module Function Description)

`code_gen_orchestrate` 当前处理 Runner 指派、真实 LangGraph dependency-check 节点和 target-resolution 节点：

- 对话层系统提示要求生成、修改、初始化类任务不要在聊天回复里直接输出代码、HTML、CSS、JS、补丁或文件全文，只整理需求并启动 `code_gen_orchestrate`。

- 入参支持 `full_requirement`，并兼容旧字段 `requirement`。
- 入参支持 `runner_id`，并兼容旧字段 `runnerId`。
- 入参支持 `context.session_id`，若未传则回退到 AgentRuntime 注入的 `WorkflowContext.sessionId`。
- 入参支持 `resume.threadId/checkpointId/interruptId`，用于选择卡片提交后恢复 LangGraph checkpoint。
- 工具顶层不接受 `allowCreateSolution`、`solutionName`、`solutionVersion`、`solutionSummary` 等创建或命名 Solution 的字段；Solution 只能来自 Runner 已有记录或 graph context 已绑定选择。
- `targetKind` 与选择卡片 action 只允许 `app/unit/data-point`；`solution` 不是 code-agent 可执行动作；dependency-check 不负责拆代码目标，只在需求本身已经明确包含多步/多项时生成多个 `routePlan[]` 项；入口推断出的 `targetKind` 是动作判定的强先验，逻辑模型会据此直接提交 action；即便 LLM 不可用，fallback 也用 `targetKind` 提交 action，只把 Solution 留给人工确认。
- `runner_id` 缺失时，不启动 graph，直接返回要求先获取 Runner 并完成指派的字符串。
- `runner_id` 存在时，先通过 SaaS hook `saas.app.runner.get` 校验 Runner 当前 `status === "mounted"`；未查到、离线或校验失败时直接返回阻断提示，不启动 graph。
- Runner 在线校验通过后，`code_gen_orchestrate` 生成稳定 thread id，后台触发 `StateGraph` + `TypeOrmCheckpointSaver`，并立即向 LLM 返回 `scheduled/resume_scheduled`，不等待 dependency-check 完成。
- graph thread id 优先复用并归一化 `context.codeGraphThreadId/threadId`，否则为本次调用生成短 thread（`code-agent:<hash>:<nonce>`），避免超过 checkpoint 表 `thread_id` 长度限制；选择卡片会携带真实 `threadId/checkpointId/interruptId`。
- dependency-check 从 `context.code_graph_log` / `context.codeGraphLog` 继承已有日志，并把每一步 append 到同一条日志链。
- dependency-check 会调用 `runner.system.hookbus.getInfo` 检查 `runner.app.solution.list` 是否存在。
- hooks 满足后调用 `runner.app.solution.list` 获取 Runner 数据库里的 Solution 摘要，并交给逻辑模型返回 JSON 决策；决策包含兼容字段 `useAction`，以及多动作字段 `useActions`、`routePlan`。
- 依赖判定提示采用"先判定、能定就定"策略：既有 Solution 只要是合理承载就直接 `useSolution` 复用（哪怕不完美也算决策），不把单个可用 Solution 挂进 `waitChoose`；只有两个以上 Solution 真正可比且选错有实质影响时才 `waitChoose`；没有合适承载才 `requiresNewSolution`，不因匹配不完美就新建近似重复容器。
- 动作 `app/unit/data-point` 同样由逻辑模型从需求语义推断并直接提交 `useAction`（UI/页面→app、后端能力/服务→unit、数据结构/存储→data-point），把入口 `targetKind` 当强先验；只有需求在车道间真正无法判定时才留 `waitChooseAction`。
- 归一化阶段对"单候选选择"做自动提交：某条 route 的 `waitChoose` 或 `waitChooseAction` 只剩一个候选时直接当作 `useSolution`/`useAction` 提交，不再因为唯一候选而发起问答。
- dependency-check / target-resolution / target-bootstrap 三个节点的逻辑模型调用都是后台 graph 任务，统一传 `isolateCallbacks: true`（隔离主对话已关闭的流式 writer，否则 minimax 等流式 provider 会因 `WritableStream is closed` 丢掉全部 content 而被迫 fallback）。**dependency-check 与 target-resolution 已工具化**（`requestDependencyDecision` / `decideTargetResolution` 走工具调用，无大 JSON、无 parse-fail 重试）；target-bootstrap 仍是小 JSON。
- 两层判定都额外产出 `notice`（一句面向用户、语言跟随需求的告知文案，不暴露 solutionId/JSON 等术语），并通过 `sendDependencyNotice`（走 `saas.app.conversation.sendMsg` 普通文本）主动发给用户：
  - dependency-check 的 notice 说明用哪个 Solution 承载、复用还是新建，在「确定需求环节」直接 `ready`（没走选择卡片、非 resume 恢复）时发，避免用户误以为"复用通用容器 default-view-solution"是复用了某个相似现成项目；
  - target-resolution 的 notice 说明具体 app/unit/data-point 是复用了哪个、还是新建，在该节点 `ready` 时发（app 层独立信息，不按 resume 过滤）。
- dependency-check 不读取 app/unit/data-point 关联列表，不解析具体对象 id/name，不做依赖分析；这些工作由 target-resolution 在 Solution/action 确认后处理。
- target-resolution 只在 dependency-check `ready` 后运行；它按已确认的 `route.useAction` 调用 `runner.app.solution.listApps`、`runner.app.solution.listUnits` 或 `runner.app.dataTouchpoint.list` 读取候选目标，不重新硬判定 action。
- target-resolution 把完整需求、routePlan、已选 Solution 和候选 app/unit/data-point 交给逻辑模型，**逐 route 调 `set_target_decision`** 工具：每项 `decision="reuse"` 引用真实候选，或 `decision="create"` 给出 `newTarget`。
- target-resolution 遇到新建 Solution 或候选为空时仍让 LLM 产出新建目标；**LLM 没产出任何决策时 code 全默认 create 兜底**（每 route 都有判定、不出现"不判定"），不再靠"非 JSON → blocked"。
- 但「逻辑模型判 reuse 却引用了不存在/候选为空的目标」不再 blocked：归一化阶段降级为 create（语义上"没有可复用候选"= 应当新建），并 warn 记录；prompt 同时硬约束"候选为空必须 create、reuse 只能照抄非空候选的精确 id/name"，双保险避免弱模型在空候选下硬判 reuse 卡死流程。
- 降级（reuse→create）会给该 route 打 `downgraded=true`；target-resolution 检测到任一 route 降级时**丢弃 LLM 的 app notice 不发**（它多半基于"复用"判定生成、会误导用户），只在日志记 `target:notice:skip`。
- target-resolution / target-bootstrap 的 `skipped` 回包把跳过原因写进 `reason` 字段、`errors` 留空，避免监控把"正常跳过"当错误误报；只有真错误才进 `errors`（blocked）。
- 摘要回写：target-bootstrap 在既有 Solution 摘要为占位/弱文案（空 / "Create or bind a new Solution…" / "…managed by code-agent"）时，用本次生成的 app 摘要回写，并由 Runner `ensureTarget` 升级该 Solution 摘要（Runner 只刷新弱摘要、永不覆盖已有真摘要），改善后续语义匹配。
- target-bootstrap 只在 target-resolution `ready` 后运行；它收集新 Solution 和 `action="app" + decision="create"` 的目标，拿完整用户需求让逻辑模型生成简短 `name/summary/description/tags`。
- target-bootstrap 的名称要求短 kebab-case slug，summary/description/tags 用来帮助后续生成节点理解目标；节点会归一化长度和 tags，但 LLM 不可用或缺失必要元数据时会 `blocked`。
- target-bootstrap 通过 `runner.app.solution.ensureTarget` 完成初步创建：新 Solution 会创建 Solution 元数据，新 app 会在已选或新建 Solution 下创建 app 元数据；unit/data-point 的真实创建留给后续专门节点。
- 即使 Runner 只返回一个 Solution，dependency-check 也不再确定性自动复用；逻辑模型必须判断该 Solution 是否适合当前需求，必要时返回 `requiresNewSolution/newSolutionOption/newSolutionReason`。
- 逻辑模型多为 reasoning 模型，超长需求会拖累，因此喂给判定/目标解析的需求先经 `compactRequirementForRouting` 压缩。**dependency-check 已工具化**（`requestDependencyDecision` 走 set_route/propose_new_solution/set_notice）—— 不再有大 JSON parse-fail 及其重试（那次实测浪费 ~21s 的病根）；`parseJsonObjectLoose` 仍供仍是 JSON 的小调用（选书、目标解析）剥 `<think>`、括号配平提取首个 JSON。**依赖判定 `decideDependencies` 也已工具化**（read_file/search_files/set_deps 工具循环, 不再 JSON parse）。规划段现只剩选书/目标解析两个小 JSON 调用，主判定链路（dependency-check / change-plan / deps）已全工具化。
- 仅当压缩、增强解析、重试都失败时才回退；回退不再把 `app/unit/data-point` 也抛给用户，而是用入口推断的 `targetKind` 直接提交动作，只让用户确认复用已有 Solution 或新建（仍给出 `newSolutionOption`），不会因为只有一个候选就直接 `ready`。
- 用户在确认卡片选择 `newSolutionOption` 后，dependency-check 会以 `ready + requiresNewSolution` 结束，把新 Solution 候选留给后续创建节点消费。
- 如果 session 已绑定 Solution 且该 Solution 的 `includes` 声明支持目标动作，dependency-check 可直接复用；绑定但明显不适配时仍进入复用/新建判断。
- 决策结果以 `routePlan` 为必要主数据；`chooseSolution`、`chooseAction`、`chooseActions` 只作为后续兼容字段从 routePlan 派生。
- 如果某个 `routePlan` 项的 Solution/action 指向仍不明确，dependency-check 节点调用 LangGraph `interrupt(payload)` 暂停；后台任务读取 state snapshot 后通过 `saas.app.conversation.sendMsg` 主动发送只包含 `saas.app.conversation.codeAgentDependencyChoice` hook fence 的消息；卡片 payload 携带按需求语种生成的 `uiText`，由组件自身说明选择含义，并把 `waiting_for_selection`、候选项与当前 `code_graph_log` 写入运行产物日志。
- 选择卡片提交到 `saas.app.conversation.codeAgentChoiceSubmit` 后，SaaS 侧重新加载 code-agent 工具并传入 `Command({ resume })`，异步恢复同一个 LangGraph thread；恢复值必须携带已确认的 `routePlan`，兼容字段从 routePlan 派生。
- 任意 hook/节点异常都会返回 `blocked` 并写入 `code_graph_log`，避免日志断裂。
- 每次后台 graph 完成或暂停后，都会把 dependency-check/target-resolution/target-bootstrap 最终回包、节点日志和最终节点回包文本写入 `logs/code-agent/<session_id>/...json`；也可用 `CODE_AGENT_LOG_DIR` 覆盖目录。
- target-bootstrap 只创建 Solution/App 元数据，不写业务代码文件、不真实创建 unit/data-point。
- change-plan 节点 (create-only) 在 target-bootstrap `ready` 后运行，是「文件处理分析 / 变更集规划」环节：
  - 只产 `op:'create'` (新增)；modify/delete 复杂度高，后续接入。module.md 大纲读取在此环节弃用 (改用新格式)。
  - **先选书再生成 (LLM 判定, 非阻断)**：节点开始先 `loadPlanningManuals` —— 经 `saas.app.knowledge.search` 列出 Agent 可见书本，逻辑模型按需求/routePlan 选用 (可多本，失败回退前端 tag 书本)，再 `saas.app.knowledge.getChapter` 加载章节 (含 LM必读) 拼成手册，注入每轮生成 prompt；选中的 `bookIds` 记进 changePlan 结果。选书 LLM 同时产出 `notice`，**选完即经 `sendDependencyNotice` 往消息窗口发一条告知** (语言跟随需求，与依赖/目标判定 notice 同一通道)。取不到书不阻断、仍生成，但每个分支都打 `knowledge:start/selected/skip/fail` 日志便于排查。本地预置「前端开发手册」(`local_frontend_dev_handbook`) 即此用途：默认前端定型 Astro (含单页/普通页面)、最小模块分块、资源目录分离、页面 JS/CSS 分离。SaaS HookBus 经 `agent.handle.ts` 串入 change-plan 节点。
  - 变更集 (changePlan) 持久化在**对应 Runner 的 Mongo** (经 `runner.app.codeAgentPlan.*` 六个专有业务 hook)，不存 SaaS 进程内存 (多租户危险)；支持局部 upsert + 局部搜索，体积大也只回切片。
  - 是一个 **code 驱动的 todo 状态机外循环 + LLM 工具调用内层** (与 generate-file 同构, **不再让 LLM 返回大 JSON**)：代码挑出开放 todo → 一轮 `runChangePlanRound` 把当前 todo + 任务切片 + 存量 hook + 已声明契约喂进 prompt，LLM **调用工具**构建 (`upsert_task` 增/改文件、`update_todo` 关 plan-target、`grep`/`search_files`/`search_by_tag` **定位**现有文件 (不读正文)、`search_hooks`/`get_hook_info` 找存量 hook、`declare_contract`/`remove_contract` 维护文字契约、`set_notice`)，createAgent 内部跑完工具循环 → 每轮完代码重算边 + 同步 resolve-edge todo → 直到无开放 todo 或撞 `maxIterations`。完成判定**只看 todo 表 (getSnapshot.openTodos) + code 权威重算边**，不信 LLM 嘴上说完成；单个工具调用坏了不毁整轮，彻底告别"not a JSON object"硬挂。
  - **按 target 的 action 分流 (关键)**：`app` (前端页面/UI) 和 `data-point` (数据结构) 只规划**文件** (`{path, summary}`)，**不产 hook、不产边** —— 一个普通页面没有 hook，页面里的 JS 函数不是 hook，prompt 明确禁止给它们编 hook/签名/calls。只有 `unit` (HookBus 后端能力) 才产 hook 契约 + action tree。
  - 一个 LLM 连贯吃完整个 routePlan (跨 solution)；对 `unit` 目标产出 action tree：每个新 hook 内联 `calls`/`compatibleWith` 出边；代码从所有任务派生 `edges` 并分类 new/existing/unresolved (无 hook 的 app/data-point 任务自然不产边)。
  - **change-plan 只定位不读正文 (轻量化)**：change-plan 只**定位**哪些文件会改 + 把编辑意图/思考链路写进 task summary，**不读文件正文** —— `read_file` 能力已从 change-plan 摘除。定位走 `search_by_tag`(最快最准)/`search_files`(按文件名)/`grep`(正则内容兜底) (经 `runner.app.codeAgentFs.grep/fastSearch/searchByTag`，围栏在 plan 目标根)；真正读文件正文是 **generate-file 自己**在产出那一个文件时再检索+读。**唯一例外是 deps 判定** (`decideDependencies`)：它是独立一轮工具循环, 自带受限 `read_file`/`search_files` —— 为了看既有 app 的 package.json 已装了什么再决定 add/remove, 决策经 `set_deps` 工具逐 app 落 (不再一次性 JSON)。
  - **联动开发契约面 (通用, 治跨文件符号漂移)**：全并发生成下各文件盲生成、共享符号 (锚点 id / 事件名 / 共享 class / payload 形状…) 会漂。change-plan 的 LLM 调 `declare_contract`/`remove_contract` 工具**维护一个契约数组** `CodeGraphContract{contractId, name, **description(文字说明承载, 把锚点/id/形状等确定值写进这句话)**, spec?(可选松结构), taskIds?}` —— **契约以文字说明为主, 不必每次额外生成 JSON**；一样的契约可用工具增删改查 (跨轮按 contractId 累积/覆盖/删除)。build-dispatch 把**全部契约注入每个 generate-file 的 Send 载荷** (`allContracts` —— 所有节点默认读到所有契约, 不再按 taskId 分派)，generate-file prompt 里"SHARED CONTRACTS you MUST honor"要求照抄其中 id/名字/形状 —— 联动的文件同源一份约定, 就不再漂 (如 nav 与各 section 共用一份锚点契约)。**不写死锚点**: 契约是通用 kind-无关的语义面, LLM 决定协定什么。前后端同构 —— 后端 unit 间共享 hook payload 形状走同一套。
  - **契约复盘门 (code 强制一步, 治"契约面建好却没被触发")**：实测发现 LLM 单轮就 upsert 完所有文件 + 关 plan-target, 把可选的 declare_contract 直接跳了 → 契约永远是 0。修法有两层: (1) **mid-loop seed**: 文件规划一收口 (无 open 的 plan-target/resolve-edge 且 ≥2 文件), code 就 seed 一个 `contract-review` todo (todo 类型加了这一种), 逼 LLM 单独一轮专做契约; `isContractRound` 时走 `buildContractReviewPrompt` (聚焦提示: 复盘全量文件、举锚点/事件/形状/共享 class 例子、逐联动 declare_contract, 不许再动文件), 跑完 code 一次性关掉该 todo。(2) **post-loop 兜底 (`contract-review:forced`)**: mid-loop seed 依赖 LLM 真把 plan-target `update_todo` 关掉才判定 planningDone —— 但逻辑模型经常不关 todo (planningDone 恒 false), 或 analysis 轮就地规划完 `continue` 直接 break, 或撞 `maxIterations`, 结果 seed 从没触发、契约仍是 0。所以**规划主循环跑完后**再兜一刀: `contracts.size===0 && tasks≥2` 就**无条件补跑一轮** `runChangePlanRound({isContractRound:true})` (不走 todo, code 直接调), 保证 declare_contract 一定有一次机会。让契约声明成为一步的主任务, 不再跟 upsert_task 抢注意力。
  - **拓扑顺序 (dependsOn)**：每个任务带粗粒度 `dependsOn: string[]` = 本 plan 内它直接组合/使用的**兄弟 taskId** (页面依赖布局+各 section 组件+样式，组件依赖共享样式/脚本；叶子文件为空)。仅 task 级、非 import 行、非 hook 边 (hook 连线仍走 calls/compatibleWith)。`computeTopoOrder` 用 Kahn 派生叶子在前的生成顺序放进回包 `topoOrder` 供下游生成节点定先后；引用到不存在的 taskId 记 `dangling`、成环任务补末尾并 warn，均不阻断。import 精连仍留给下游 Integrator (AST)、脚手架/包依赖归 archetype 层，change-plan 只表达粗粒度关系。
  - **验图自纠**：unresolved 边由代码注入 `resolve-edge` todo (被 LLM 错误关掉的会重新打开、已解决的由代码关掉)，逼模型补一个新任务定义它、或搜到既有 hook、或删边；这类 todo 状态由代码权威同步。new→existing 边靠 `searchSolutionHooks` (scope 到 routePlan solution 的 app/unit) 解析，存量 hook 改不了 (create-only)，新侧适配。
  - **路径是完整的 solution/app 相对路径**：模型只产目标内文件路径 (如 `index.html`)，代码用 target 的 `basePath` (`deriveTargetBasePath`, 来自 `useTarget.path` 裁成 workspace 相对、或按 `solutions/<sol>/apps/<app>` 构造) `joinTargetPath` 拼成完整相对路径，并做 `..`/绝对路径防越界 (作用域围栏)；多目标时模型须带 `routeId` 定位。
  - change-plan 不阻断流水线：撞迭代上限仍有开放 todo 时 status 仍 `ready`，只 warn + 记 `reason`，回包带 `openTodos` 供下游判断。
  - 运行产物 (`logs/code-agent/.../*.json`) 已瘦身：节点日志去重 (顶层 `log` 留一份，`result.*.log` / `result.context.code_graph_log` 标 `[see top-level log]`)，`input` 剥掉与 `request.full_requirement` 重复的需求全文。
  - **项目初始化 + 依赖 (project-init 节点, 在生成之前)**：change-plan 里 `decideInitTargets` 判每个 app 目标 —— **needsScaffold** 由 ground-truth `init.lock` 定 (`runner.app.codeAgentFs.checkInitLock`；无锁→要脚手架, 有锁→跳；通用不绑技术栈), **依赖增删** 由 `decideDependencies` 一轮工具循环定 (read_file 看现有 package.json → set_deps 逐 app 落 `deps:{add,remove}`, 保持最小); 要脚手架**或**有依赖变更的 app 才入 `changePlan.initPlan`。图上 `change-plan → project-init →[gateAfterProvision]→ build-dispatch`：`project-init` 逐目标跑**LLM 终端工具循环** (`run_terminal`/`read_file`)：needsScaffold 则按手册脚手架 (**pnpm**: `pnpm create astro@latest . --template minimal --install …`)、再按 deps `pnpm add <add>` / `pnpm remove <remove>`；needsScaffold 目标验 package.json 落盘后**写 `init.lock`** (`writeInitLock`, 下次跳过), 仅依赖变更的目标不重脚手架、不写锁。`run_terminal` 走 `runner.app.codeAgentFs.runCommand` (cwd 围栏、有界超时、无通知)。汇成 `changePlan.init`, 有失败置 blocked。无 initPlan 则透传跳过。**统一用 pnpm**: Runner 起动时 `ensureWorkspacePnpmStore` 把 pnpm store 钉到 workspace 同卷 (`<workspace>/.pnpm-store`) → 硬链接、所有 app 共享一份 store, 第二个 app 起装依赖近乎秒过 (不同版本各存不冲突)。build-test 的构建命令同为 `pnpm build`。
  - **provision→generation 边界 (终端初始化与项目生成分开)**：`project-init` 后不再无条件进生成，而是过 `gateAfterProvision` 条件边 —— **status≠blocked 才进 build-dispatch，否则直接 END**。这把"环境初始化失败 (脚手架/装包坏了 → blocked)"和"代码生成失败 (repair 循环)"分成**两条独立终止路径**：环境没搭好就不往一个非就绪的 env 里空生成。plan 被 blocked 时同样短路 (project-init 本就对 blocked plan no-op)。同一 thread/checkpointer、串行，只是边界清晰、各自失败各自处理 (起步形态，未抽成独立 subgraph)。
  - **构建测试 + 返修 (build-test 节点, 生成之后, 判定一定是 LLM)**：文件齐 (build-join) 后接 `build-test`：跑 **LLM 工具循环** —— `run_terminal` 自己跑 `npm run build`、`read_file` 看报错源码、`add_repair_task({path,issue})` 把"哪个文件、什么问题"塞进 `changePlan.extraPlan`。**没塞任何返修任务 = LLM 判构建通过** (不拿 exitCode 判死: 0 退出但结果坏也算问题, 有些 warning 可接受)。有返修 → 每个返修任务经 `packFixSend` 打成 **fix-mode `BuildFileSend`** (照抄 dispatch 载荷 + `fix.issue`)，`fanOutBuildTestRepair` 用 Send **复用 generate-file** 节点 (FIX 模式: 读现文件、精准修、重写)，天然回环 `generate-file → build-verify → build-join → build-test` 再测。有界 `maxBuildTestRounds` (默认 3, 约 2 次返修 + 1 次终判)；超预算还不过 → 置 `blocked` + reason。图: `build-join → build-test →[fanOutBuildTestRepair]→ (generate-file 返修回环 | END)`。extraPlan 也预留给未来其它扩展。
  - **构建子图 (build subgraph, 消费 changeTasks)**：project-init 之后经 `gateAfterProvision` 接 `build-dispatch → (Send 扇出) generate-file×N → build-verify →(缺文件 Send 重触发→generate-file, 回环) / (齐了) build-join → build-test → END`。dispatch 按 `topoOrder` 排序、载入手册、种 `generate-file` todo、打包每文件 Send 载荷；每个 `generate-file` 是一个**并发单文件代码节点**，跑**真 tool-calling 循环**：给模型绑一组可执行工具 (write_file 全量写、**edit_file 定点字串替换 (修改能力)**、read_file/grep/fast_search[/get_hook_info]、注释 keyword 的 list_keywords/search_keywords/add_keyword、update_todo)，由 AI 层 `ai-model.service` 的 `createAgent` 内部执行工具循环，**无 JSON 解析**；工具闭包绑 planId/taskId/runnerId，内部调 `runner.app.codeAgentFs.*` / `runner.app.appTag.*` / `runner.system.hookbus.getInfo`；write_file 或 edit_file 成功即闭包捕获完成。join 汇成 `changePlan.build`。**修改能力 (edit_file)**：build-test 返修时 Send 载荷带 `fix.issue` → 节点进 FIX 模式, prompt 让它 read_file 现文件后**优先 edit_file 定点改**(只换坏的片段、不重写整份、不碰无关处), 走 `runner.app.codeAgentFs.editFile` (原子字串替换); 这就是"在返修环节给代码节点加的修改原语", 也预留给未来 op:modify。
  - **注释 keyword 纪律 (补全注释是完成的一部分, 由 todo 监督)**：生成的文件必须补**文档注释**, 用**单个 `@keyword` 行**, 词按 `维度:词` 标注; 维度是**固定的工程向 4 维** (`功能职责/技术栈/数据接口/依赖关系`, 不在集内归 `其他`) —— 即"限定 tag 维度"是限维度、维度下的词开放。prompt 让 LLM 逐符号沿 4 维想、每维给个词 (共 2-5 个), 用前先 list_keywords/search_keywords 复用、找不到才 add_keyword({dimension,keyword}), 不许编造。**代码不只靠 prompt**：`validateGeneratedFile` (完成②) 对含声明的代码文件强制校验 `@keyword` 存在 (兼容旧 `-cn/-en`), 缺则 generate-file todo 不关、循环催办补注释 —— "todo 监督这部分"。
  - **构建后代码回填词表**：build-join 里 `collectAndSyncKeywords` 调 `runner.app.codeAgentFs.collectKeywords` 扫**全部文件**的 `@keyword` (解析 `维度:词` 条目、每行截 5、去 @)、按 appId 分组, 再 `runner.app.appTag.ensureMany` 按维度同步进 `tags.json` (维度归一到 4 维+其他、去重、只加缺的)。即 **维度化 tags.json (`{维度:[词]}`) 由代码从文件真实收集回填**, 不只靠 LLM add_keyword; best-effort, 同步失败不阻断构建。
  - **todo 驱动的完成循环 (单文件内)**：每个文件有 `generate-file:<taskId>` todo。每轮跑一次完整 tool-calling 回复后，**代码按真实产物判完成** (写过 write_file + 非空 + ②规则通过) → 代码权威关 todo 为 done；未完成则把原因写进 todo 进展、下一轮 prompt **按 todo 催办**重跑 (至 `maxGenerateRounds`)。LLM 可用 `update_todo` 调进展/置 in_progress，但**不能自己置 done** (done 是代码保底)。这就是"LLM 做事为主、代码权威兜底"落到单文件。
  - **完成判定三层**：① LLM 自驱做事 (调工具写文件)；② 文件级规则校验 (`validateGeneratedFile`, todo 监督)：含声明的代码文件强制 `@keyword-cn`/`@keyword-en` 文档注释, 缺即未完成 (Astro parse 规则后续)；③ 代码兜底 (没写/空文件/校验失败=未完成 → 催办重跑；轮次用尽仍不成 → 结果 failed → build-join 置 blocked, 不谎报 ready)。checkpointer 做重试隔离, 不拆 thread；全并发生成、topoOrder 只喂上下文不串行化。
  - **AI adapter**：`AgentAiRequest` 增 `tools?` 字段，`buildAiRequest` 里**每次调用的 tools 覆盖 adapter 固定工具**，让 code 生成节点跑自己那组工具 (纯附加, 不影响不传 tools 的调用)。
  - **验证 + repair 回环 (跨文件断链兜底)**：全并发 generate-file 跑完后 `build-verify` 调 `runner.app.codeAgentFs.verifyTasks` 按 **changePlan 落盘真相**查哪些文件没建 (不存在/空)；缺文件就从 `state.buildFiles` 过滤出对应 Send 载荷、Send **重触发**那些 generate-file (回到 verify, 成环)，最多 `maxRepairRounds` 轮；齐了→`build-join`(ready)，超轮仍缺→`build-join` 置 **blocked** + reason 列缺失文件。verify 出错 fail-open (视为齐全) 免死循环；buildResults reducer 跨 repair 轮累加, finalize 按 taskId 取最后一次。这修的是"全并发下某文件掉点→兄弟断链"。
  - **待接 (下一刀)**：Astro 单文件校验规则；Integrator 按 topoOrder 装配 (import 精连/zod from schema)；影子测试 + QA 节点。
