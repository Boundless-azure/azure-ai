import type { CodeAgentTargetKind } from '../dialogues/types';

/**
 * @title Code Agent workflow context
 * @description Context injected by AgentRuntime before tool calls.
 * @keyword-cn ??????, ????
 * @keyword-en workflow-context, session-callback
 */
export interface WorkflowContext {
  /** ??? IM ?? ID */
  sessionId: string;
  /** Agent ??? ID */
  agentId?: string;
  /** Agent ? Principal ID */
  agentPrincipalId: string;
  /** ????/Agent ????? ID ?? */
  aiModelIds?: string[];
}

/**
 * @title Code graph tool context
 * @description Context block passed into the code graph tool.
 * @keyword-cn ??Graph???, ????
 * @keyword-en code-graph-context, session-callback
 */
export type CodeGraphToolContext = {
  session_id?: string;
  sessionId?: string;
  [key: string]: unknown;
};

/**
 * @title Code graph request
 * @description Normalized request envelope prepared before future graph execution.
 * @keyword-cn ??Graph??, Runner??
 * @keyword-en code-graph-request, runner-assignment
 */
export type CodeGraphRequest = {
  full_requirement: string;
  runner_id: string;
  context: {
    session_id?: string;
    [key: string]: unknown;
  };
};

export type HookCallReplyLike = {
  errorMsg?: string[];
  result: unknown;
  debugLog?: unknown[];
};

type HookCallContextLike = {
  source?: 'llm' | 'system' | 'http' | 'runner';
  principalId?: string;
  principalType?: string;
  extras?: Record<string, unknown>;
};

/**
 * @title Runner hook caller
 * @description Minimal bridge used by dependency-check to call Runner hooks.
 * @keyword-en hook-caller, runner-hook
 */
export type HookCaller = {
  callHook(
    runnerId: string,
    body: {
      hookName: string;
      payload?: unknown;
      context?: HookCallContextLike;
    },
  ): Promise<HookCallReplyLike>;
};

export type CodeGenOrchestrateInput = {
  full_requirement?: string;
  requirement?: string;
  runner_id?: string;
  context?: CodeGraphToolContext;
  resume?: CodeGraphResumeRef;
  targetKind?: CodeAgentTargetKind;
  logicModelId?: string;
  frontendModelId?: string;
  logicModelIndex?: number;
  frontendModelIndex?: number;
  runnerId?: string;
  appName?: string;
  appVersion?: string;
  appDescription?: string;
  unitName?: string;
};

/**
 * @title Code graph action values
 * @description Supported broad actions for the dependency-check node and tool schema.
 * @keyword-en action-selection, target-kind
 */
export const CODE_GRAPH_ACTION_VALUES = ['app', 'unit', 'data-point'] as const;

export type CodeGraphActionKind = (typeof CODE_GRAPH_ACTION_VALUES)[number];

/**
 * @title New solution choice id
 * @description Sentinel choice id used when dependency-check selects a new Solution option.
 * @keyword-cn ?Solution??, ????
 * @keyword-en new-solution-option, dependency-selection
 */
export const NEW_SOLUTION_CHOICE_ID = '__new_solution__';

export type RunnerSolutionSummary = {
  id: string;
  runnerId: string;
  solutionId: string;
  name: string;
  version?: string;
  summary: string;
  description?: string;
  includes: string[];
  isInitialized?: boolean;
};

export type CodeGraphNewSolutionOption = {
  id: typeof NEW_SOLUTION_CHOICE_ID;
  kind: 'new-solution';
  name: string;
  version?: string;
  summary: string;
  reason?: string;
  targetKind: CodeAgentTargetKind;
};

/**
 * @title Concrete target reuse/create decision
 * @description Decision kind used after the broad app/unit/data-point action is selected.
 * @keyword-cn 目标复用, 目标新建
 * @keyword-en target-selection, target-create
 */
export type CodeGraphTargetDecisionKind = 'reuse' | 'create';

/**
 * @title Concrete target summary
 * @description Normalized app, unit, or data-point candidate discovered under a selected Solution.
 * @keyword-cn 目标候选, 目标复用
 * @keyword-en target-candidate, target-selection
 */
export type CodeGraphConcreteTargetSummary = {
  id: string;
  action: CodeGraphActionKind;
  name: string;
  solutionId?: string;
  solutionName?: string;
  description?: string;
  path?: string;
  status?: string;
  isInitialized?: boolean;
  sources?: string[];
};

/**
 * @title New concrete target option
 * @description LLM-proposed app, unit, or data-point target to create in a later node.
 * @keyword-cn 目标新建, 目标判定
 * @keyword-en target-create, target-resolution
 */
export type CodeGraphNewTargetOption = {
  action: CodeGraphActionKind;
  name: string;
  summary: string;
  reason?: string;
};

/**
 * @title Concrete target route decision
 * @description Per-route decision that either reuses one target candidate or proposes a new target.
 * @keyword-cn 目标判定, 路由计划
 * @keyword-en target-resolution, route-plan
 */
export type CodeGraphTargetRouteDecision = {
  routeId: string;
  requirement: string;
  title: string;
  summary: string;
  action: CodeGraphActionKind;
  solution: RunnerSolutionSummary | CodeGraphNewSolutionOption | null;
  decision: CodeGraphTargetDecisionKind;
  useTarget: CodeGraphConcreteTargetSummary | null;
  newTarget: CodeGraphNewTargetOption | null;
  candidates: CodeGraphConcreteTargetSummary[];
  reason?: string;
  /** true 表示这条 create 是由 reuse 解析失败降级而来 (LLM 判 reuse 但候选对不上) */
  downgraded?: boolean;
};

/**
 * @title Bootstrap metadata
 * @description Short LLM-generated metadata used to ensure a Solution or app target.
 * @keyword-cn 初始创建, 元数据生成
 * @keyword-en target-bootstrap, metadata-generation
 */
export type CodeGraphBootstrapMetadata = {
  name: string;
  version?: string;
  summary: string;
  description?: string;
  tags: string[];
};

/**
 * @title Bootstrap ensure entry
 * @description One Solution or app metadata object ensured through the Runner hook.
 * @keyword-cn 初始创建, 目标新建
 * @keyword-en target-bootstrap, target-create
 */
export type CodeGraphBootstrapEntry = {
  kind: 'solution' | 'app';
  routeId?: string;
  action?: CodeGraphActionKind;
  solutionId?: string;
  solutionName: string;
  appId?: string;
  appName?: string;
  metadata: CodeGraphBootstrapMetadata;
  reason?: string;
};

export type CodeGraphRequirementRoute = {
  id: string;
  requirement: string;
  title: string;
  summary: string;
  waitChoose: RunnerSolutionSummary[];
  useSolution: RunnerSolutionSummary | null;
  waitChooseAction: CodeGraphActionKind[];
  useAction: CodeGraphActionKind | null;
  reason?: string;
};

export type CodeGraphDependencyDecision = {
  waitChoose: RunnerSolutionSummary[];
  useSolution: RunnerSolutionSummary | null;
  waitChooseAction: CodeGraphActionKind[];
  useAction: CodeGraphActionKind | null;
  useActions: CodeGraphActionKind[];
  routePlan: CodeGraphRequirementRoute[];
  requiresNewSolution: boolean;
  newSolutionOption?: CodeGraphNewSolutionOption;
  newSolutionReason?: string;
  reason?: string;
  /** 面向用户的本地化告知文案：用哪个 Solution 承载、复用还是新建 (语言跟随需求) */
  notice?: string;
};

export type CodeGraphRuntimeContext = {
  chooseSolution: string;
  chooseAction: CodeGraphActionKind | '';
  chooseActions: CodeGraphActionKind[];
  routePlan: CodeGraphRequirementRoute[];
  targetPlan?: CodeGraphTargetRouteDecision[];
  targetBootstrap?: CodeGraphBootstrapEntry[];
  changePlan?: CodeGraphChangeTask[];
  selectedSolution?: RunnerSolutionSummary | CodeGraphNewSolutionOption;
  newSolutionOption?: CodeGraphNewSolutionOption;
  code_graph_log: CodeGraphLogEntry[];
};

/**
 * @title Hook contract
 * @description One hook a change task declares: name, signature (JSON), summary, and out-edges.
 * @keyword-cn hook契约, 依赖边
 * @keyword-en hook-contract, dependency-edge
 */
export type CodeGraphHookContract = {
  name: string;
  summary?: string;
  signature?: Record<string, unknown>;
  calls?: string[];
  compatibleWith?: string[];
};

/**
 * @title Change task
 * @description One change-plan node: a file plus the hook contracts it declares. `op` picks the dispatch
 *   lane — `create` writes a NEW file (writeTaskFile), `modify` edits an EXISTING file in place (editFile,
 *   read→targeted edit). Default create; modify drives二次修改 on files located via search_by_tag.
 * @keyword-cn 变更任务, 新建或修改
 * @keyword-en change-task, create-or-modify
 */
export type CodeGraphChangeTask = {
  taskId: string;
  routeId?: string;
  targetId?: string;
  solutionId?: string;
  action?: CodeGraphActionKind;
  op: 'create' | 'modify';
  path: string;
  /** 该文件是什么 (面向下游生成节点; app/data-point 文件靠它表达用途) */
  summary?: string;
  /** 仅 unit 目标产出 hook 契约; app/data-point 为空 */
  hooks: CodeGraphHookContract[];
  /** 本 plan 内该文件直接组合/依赖的其它 taskId (粗粒度, 非 import 行、非 hook 边); 供拓扑排序 */
  dependsOn?: string[];
  /** 生成本文件要参考的手册章节 id (change-plan 按文件规划; dispatch 只给这几章, 不灌整本) */
  chapters?: string[];
  reason?: string;
};

/**
 * @title Change plan dependency edge
 * @description A derived edge between hook contracts, classified by how its target resolves.
 * @keyword-cn 依赖边, 边解析
 * @keyword-en dependency-edge, edge-resolution
 */
export type CodeGraphChangePlanEdge = {
  from: string;
  to: string;
  kind: 'calls' | 'compatibleWith';
  resolved: 'new' | 'existing' | 'unresolved';
};

export type CodeGraphResumeRef = {
  threadId?: string;
  checkpointId?: string;
  interruptId?: string;
};

export type CodeGraphLogLevel = 'info' | 'warn' | 'error';

export type CodeGraphLogEntry = {
  ts: string;
  node: string;
  step: string;
  level: CodeGraphLogLevel;
  message: string;
  data?: unknown;
};

export type CodeGraphNodeLogger = {
  entries: CodeGraphLogEntry[];
  info(step: string, message: string, data?: unknown): void;
  warn(step: string, message: string, data?: unknown): void;
  error(step: string, message: string, data?: unknown): void;
};

export type CodeGraphDependencyCheckResult = {
  status: 'ready' | 'waiting_for_selection' | 'blocked';
  node: 'dependency-check';
  hooks: {
    required: string[];
    available: string[];
    missing: string[];
  };
  context: CodeGraphRuntimeContext;
  solutions: RunnerSolutionSummary[];
  decision: CodeGraphDependencyDecision;
  targetResolution?: CodeGraphTargetResolutionResult;
  targetBootstrap?: CodeGraphTargetBootstrapResult;
  changePlan?: CodeGraphChangePlanResult;
  errors: string[];
  log: CodeGraphLogEntry[];
};

/**
 * @title Target resolution result
 * @description Result produced by the second code graph node after dependency-check has selected route actions.
 * @keyword-cn 目标判定, Graph输出
 * @keyword-en target-resolution, graph-output
 */
export type CodeGraphTargetResolutionResult = {
  status: 'ready' | 'skipped' | 'blocked';
  node: 'target-resolution';
  targetPlan: CodeGraphTargetRouteDecision[];
  /** 面向用户的本地化告知文案：每条 route 的具体 app/unit/data-point 是复用还是新建 */
  notice?: string;
  /** skipped 时的跳过原因 (与真错误 errors 区分, 避免监控误报) */
  reason?: string;
  errors: string[];
  log: CodeGraphLogEntry[];
};

/**
 * @title Target bootstrap result
 * @description Result produced after ensuring initial Solution/app metadata for create decisions.
 * @keyword-cn 初始创建, Graph输出
 * @keyword-en target-bootstrap, graph-output
 */
export type CodeGraphTargetBootstrapResult = {
  status: 'ready' | 'skipped' | 'blocked';
  node: 'target-bootstrap';
  entries: CodeGraphBootstrapEntry[];
  /** skipped 时的跳过原因 (与真错误 errors 区分, 避免监控误报) */
  reason?: string;
  errors: string[];
  log: CodeGraphLogEntry[];
};

/**
 * @title Change plan result
 * @description Result of the create-only change-plan node: the changeTask set, derived edges,
 *   and the code-driven todo loop outcome (open todos / iterations). Stored alongside the
 *   durable Mongo-backed plan addressed by planId.
 * @keyword-cn 变更集结果, Graph输出
 * @keyword-en change-plan-result, graph-output
 */
/**
 * @title Build file artifact
 * @description One file's outcome from the concurrent build subgraph (materialized/failed/skipped).
 * @keyword-cn 构建产物, 文件结果
 * @keyword-en build-file, file-result
 */
export type CodeGraphBuildFile = {
  taskId: string;
  path: string;
  status: 'written' | 'failed' | 'skipped';
  bytes?: number;
  turns: number;
  error?: string;
};

/**
 * @title Build summary
 * @description Aggregate of the concurrent build subgraph attached to the change-plan result.
 * @keyword-cn 构建汇总, 生成子图
 * @keyword-en build-summary, build-subgraph
 */
export type CodeGraphBuildSummary = {
  total: number;
  written: number;
  failed: number;
  files: CodeGraphBuildFile[];
};

/**
 * @title Project init target
 * @description One app target that change-plan判定 needs scaffolding/initialization before code gen.
 * @keyword-cn 初始化目标, 脚手架
 * @keyword-en init-target, scaffold
 */
export type CodeGraphInitTarget = {
  appId?: string;
  appDir: string;
  archetype?: string;
  bookIds?: string[];
  /** 是否需要脚手架 (无 init.lock); false 时该目标只做依赖增删 */
  needsScaffold: boolean;
  /** change-plan 判定的依赖增删 (npm 包): add 引入, remove 移除 */
  deps?: { add: string[]; remove: string[] };
  reason?: string;
};

/**
 * @title Project init summary
 * @description Outcome of the project-init node: per app target whether scaffolding succeeded.
 * @keyword-cn 初始化汇总, 脚手架结果
 * @keyword-en init-summary, scaffold-result
 */
export type CodeGraphInitSummary = {
  total: number;
  ok: number;
  failed: number;
  targets: Array<{
    appDir: string;
    ok: boolean;
    turns: number;
    error?: string;
  }>;
};

/**
 * @title Contract surface
 * @description 通用「联动开发契约」: change-plan 的 LLM 协定的一份跨文件共享约定 (锚点/事件名/共享 class/
 *   payload 形状… 任意语义), 挂在参与的 plan 节点 (taskIds) 上; 这些节点生成时都读到它, 从而对齐。
 *   前后端同构 —— 后端 unit 间共享 hook payload 形状也走这个。
 * @keyword-cn 契约面, 联动契约
 * @keyword-en contract-surface, coupling-contract
 */
export type CodeGraphContract = {
  contractId: string;
  /** 语义名, 如 "页面锚点" / "购物车事件" */
  name?: string;
  /** 这份契约管什么 (语义描述) */
  description?: string;
  /** 协定的内容 (语义/松结构, 由 LLM 写: 值/名字/形状) */
  spec?: unknown;
  /** 参与该契约的 plan 节点 (联动的 taskId) */
  taskIds: string[];
};

/**
 * @title Extra plan task (build-test rework / extension)
 * @description 一个返修/扩展任务: build-test 的 LLM 从构建输出判定"要修哪个文件、什么问题"后塞进
 *   extraPlan; 之后**复用 generate-file 节点** (fix 模式) 来完成。也预留给未来的其它扩展。
 * @keyword-cn 扩展任务, 返修任务
 * @keyword-en extra-task, rework-task
 */
export type CodeGraphExtraTask = {
  /** 要返修/扩展的文件 taskId (对应 changeTasks 里的一个) */
  taskId: string;
  path: string;
  targetId?: string;
  /** 要修/加什么 (LLM 从构建输出判定的具体问题或扩展点) */
  issue: string;
  /** 来源: 'build-test' 返修 / 未来其它扩展 */
  origin?: string;
};

/**
 * @title Build-test summary
 * @description build-test 节点的汇总: LLM 判定构建是否通过 (无返修任务 = 通过)、跑了几轮。
 * @keyword-cn 构建测试汇总, 返修
 * @keyword-en build-test-summary, rework
 */
export type CodeGraphBuildTestSummary = {
  /** LLM 判定构建是否通过 (无返修任务 = 通过) */
  ok: boolean;
  /** 跑过的 build-test 轮数 */
  rounds: number;
  /** 最后一轮 LLM 判定的待返修任务数 */
  pendingFixes: number;
  /** 简述 (最后一轮构建结论) */
  summary?: string;
};

export type CodeGraphChangePlanResult = {
  status: 'ready' | 'skipped' | 'blocked';
  node: 'change-plan';
  planId: string;
  changeTasks: CodeGraphChangeTask[];
  edges: CodeGraphChangePlanEdge[];
  /** LLM 协定的联动开发契约面 (跨文件共享约定, 挂在 taskIds 上; 生成时注入参与节点) */
  contracts?: CodeGraphContract[];
  /** 变更任务的拓扑生成顺序 (taskId, 按 dependsOn 排, 叶子在前); 供下游生成节点决定先后 */
  topoOrder?: string[];
  /** change-plan LLM 判定需要脚手架初始化的 app 目标 (供 project-init 节点); 空/不需要则省略 */
  initPlan?: CodeGraphInitTarget[];
  /** project-init 节点跑完后的初始化汇总 (每 app 目标脚手架成败) */
  init?: CodeGraphInitSummary;
  /** 并发构建子图跑完后附上的产物汇总 (materialized/failed 计数 + 每文件结果) */
  build?: CodeGraphBuildSummary;
  /** build-test 返修/扩展任务 (LLM 从构建输出判定要修哪些文件); 复用 generate-file 修 */
  extraPlan?: CodeGraphExtraTask[];
  /** build-test 节点汇总 (构建是否通过 + 轮数) */
  buildTest?: CodeGraphBuildTestSummary;
  /** 本次规划选用的知识库书本 id (先选书) */
  bookIds?: string[];
  openTodos: number;
  iterations: number;
  /** 面向用户的本地化告知文案：将新增哪些文件/能力 (语言跟随需求) */
  notice?: string;
  /** skipped 时的跳过原因 (与真错误 errors 区分, 避免监控误报) */
  reason?: string;
  errors: string[];
  log: CodeGraphLogEntry[];
};

export type CodeGraphDependencyResumeChoice = {
  chooseSolution?: string;
  chooseAction?: CodeGraphActionKind;
  chooseActions?: CodeGraphActionKind[];
  routePlan: CodeGraphRequirementRoute[];
  selectedSolution?: RunnerSolutionSummary | Record<string, unknown>;
  context?: Record<string, unknown>;
};

export type CodeGraphDependencyInterruptPayload = {
  type: 'code-agent.dependency-choice';
  runnerId: string;
  sessionId?: string;
  requirement: string;
  targetKind: CodeAgentTargetKind;
  hooks: CodeGraphDependencyCheckResult['hooks'];
  context: CodeGraphRuntimeContext;
  solutions: RunnerSolutionSummary[];
  decision: CodeGraphDependencyDecision;
};

export type LlmDependencyDecisionPayload = {
  waitChoose?: Array<{
    id?: string;
    solutionId?: string;
    name?: string;
    reason?: string;
  }>;
  useSolution?: {
    id?: string;
    solutionId?: string;
    name?: string;
    reason?: string;
  } | null;
  waitChooseAction?: CodeGraphActionKind[];
  useAction?: CodeGraphActionKind | null;
  useActions?: CodeGraphActionKind[];
  routePlan?: Array<{
    id?: string;
    requirement?: string;
    title?: string;
    summary?: string;
    waitChoose?: Array<{
      id?: string;
      solutionId?: string;
      name?: string;
      reason?: string;
    }>;
    useSolution?: {
      id?: string;
      solutionId?: string;
      name?: string;
      reason?: string;
    } | null;
    waitChooseAction?: CodeGraphActionKind[];
    useAction?: CodeGraphActionKind | null;
    reason?: string;
  }>;
  requiresNewSolution?: boolean;
  newSolutionOption?: {
    name?: string;
    version?: string;
    summary?: string;
    reason?: string;
  } | null;
  newSolutionReason?: string;
  reason?: string;
  notice?: string;
};

/**
 * @title Required runner solution hooks
 * @description Runner hook names dependency-check needs before it can inspect Solution state.
 * @keyword-cn Runner???Hook, Hook??
 * @keyword-en runner-db-hooks, hook-probe
 */
export const REQUIRED_RUNNER_SOLUTION_HOOKS = [
  'runner.app.solution.list',
] as const;
/**
 * @title Conversation send message hook
 * @description SaaS hook proxied through Runner to send dependency choice cards.
 * @keyword-cn ??????, Hook??
 * @keyword-en selection-card-send, hook-component
 */
export const CONVERSATION_SEND_MSG_HOOK = 'saas.app.conversation.sendMsg';
/**
 * @title Dependency choice component hook
 * @description Hook component action used to render code-agent dependency choices.
 * @keyword-cn ????, Hook??
 * @keyword-en selection-card, hook-component
 */
export const CODE_AGENT_DEPENDENCY_CHOICE_COMPONENT_HOOK =
  'saas.app.conversation.codeAgentDependencyChoice';
