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
