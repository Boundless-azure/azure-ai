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
};

export type CodeGraphRuntimeContext = {
  chooseSolution: string;
  chooseAction: CodeGraphActionKind | '';
  chooseActions: CodeGraphActionKind[];
  routePlan: CodeGraphRequirementRoute[];
  targetPlan?: CodeGraphTargetRouteDecision[];
  selectedSolution?: RunnerSolutionSummary | CodeGraphNewSolutionOption;
  newSolutionOption?: CodeGraphNewSolutionOption;
  code_graph_log: CodeGraphLogEntry[];
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
