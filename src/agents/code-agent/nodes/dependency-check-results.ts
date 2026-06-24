import { createCodeGraphNodeLogger } from './dependency-check-log';
import { REQUIRED_RUNNER_SOLUTION_HOOKS } from './dependency-check.types';
import type {
  CodeGraphDependencyCheckResult,
  CodeGraphDependencyInterruptPayload,
  CodeGraphLogEntry,
  CodeGraphRequest,
} from './dependency-check.types';

/**
 * Read the dependency-check result from a completed graph output.
 * @keyword-cn Graph输出, 依赖检查节点
 * @keyword-en graph-output, dependency-check-node
 */
export function readCodeGenGraphDependencyCheck(
  output: unknown,
): CodeGraphDependencyCheckResult | null {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return null;
  }
  const value = (output as Record<string, unknown>).dependencyCheck;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = value as Partial<CodeGraphDependencyCheckResult>;
  return result.node === 'dependency-check' && result.status
    ? (value as CodeGraphDependencyCheckResult)
    : null;
}

/**
 * Build a waiting result from the LangGraph interrupt payload.
 * @keyword-cn 中断回包, 依赖检查节点
 * @keyword-en interrupt-result, dependency-check-node
 */
export function buildWaitingDependencyCheckResultFromInterrupt(
  payload: CodeGraphDependencyInterruptPayload,
  log: CodeGraphLogEntry[],
): CodeGraphDependencyCheckResult {
  return {
    status: 'waiting_for_selection',
    node: 'dependency-check',
    hooks: payload.hooks,
    context: { ...payload.context, code_graph_log: log },
    solutions: payload.solutions,
    decision: payload.decision,
    errors: [],
    log,
  };
}

/**
 * Build a blocked dependency-check result before the graph can continue.
 * @keyword-cn 工具回包, 阻塞状态
 * @keyword-en tool-result, blocked-status
 */
export function buildBlockedDependencyCheckResult(
  request: CodeGraphRequest,
  reason: string,
): CodeGraphDependencyCheckResult {
  const graphLog = createCodeGraphNodeLogger(
    'dependency-check',
    request.context,
  );
  graphLog.error('blocked', reason);
  return {
    status: 'blocked',
    node: 'dependency-check',
    hooks: {
      required: [...REQUIRED_RUNNER_SOLUTION_HOOKS],
      available: [],
      missing: [],
    },
    context: {
      chooseSolution: '',
      chooseAction: '',
      chooseActions: [],
      routePlan: [],
      code_graph_log: graphLog.entries,
    },
    solutions: [],
    decision: {
      waitChoose: [],
      useSolution: null,
      waitChooseAction: [],
      useAction: null,
      useActions: [],
      routePlan: [],
      requiresNewSolution: false,
      reason,
    },
    errors: [reason],
    log: graphLog.entries,
  };
}

/**
 * Build the tool response for the dependency check node.
 * @keyword-cn 工具回包, 依赖检查节点
 * @keyword-en tool-result, dependency-check-node
 */
export function buildDependencyCheckResultMessage(
  request: CodeGraphRequest,
  result: CodeGraphDependencyCheckResult,
): string {
  const body = {
    status: result.status,
    node: result.node,
    runner_id: request.runner_id,
    session_id: request.context.session_id ?? null,
    context: result.context,
    hooks: result.hooks,
    decision: result.decision,
    log: result.log,
    solutions: result.solutions.map((solution) => ({
      id: solution.id,
      runnerId: solution.runnerId,
      solutionId: solution.solutionId,
      name: solution.name,
      summary: solution.summary,
      includes: solution.includes,
      isInitialized: solution.isInitialized,
    })),
    errors: result.errors,
    next:
      result.status === 'ready'
        ? 'dependency-check complete; continue to the next code graph node'
        : result.status === 'waiting_for_selection'
          ? 'pause before next node; caller must resolve routePlan selections and resume with updated context'
          : 'blocked; fix missing runner hooks, hook caller, or AI adapter first',
  };
  return [
    'code graph dependency-check result:',
    JSON.stringify(body, null, 2),
  ].join('\n');
}
