import type {
  CodeGraphDependencyCheckResult,
  HookCaller,
  HookCallReplyLike,
  RunnerSolutionSummary,
  WorkflowContext,
} from './dependency-check.types';
import { REQUIRED_RUNNER_SOLUTION_HOOKS } from './dependency-check.types';
import { readItems, readStringField } from './dependency-check-context';

/**
 * Probe whether the runner has the solution DB hooks required by code-agent.
 * @keyword-cn Hook探测, Runner数据库
 * @keyword-en hook-probe, runner-db-hooks
 */
export async function probeRunnerSolutionHooks(
  hookCaller: HookCaller,
  runnerId: string,
  workflowContext: WorkflowContext | null,
): Promise<CodeGraphDependencyCheckResult['hooks']> {
  const data = await callRunnerHookData(
    hookCaller,
    runnerId,
    'runner.system.hookbus.getInfo',
    [{ hookNames: [...REQUIRED_RUNNER_SOLUTION_HOOKS] }],
    workflowContext,
  );
  const items = readItems(data);
  const available = items
    .map((item) => readStringField(item, 'name'))
    .filter(Boolean);
  const missing = REQUIRED_RUNNER_SOLUTION_HOOKS.filter(
    (hookName) => !available.includes(hookName),
  );
  return {
    required: [...REQUIRED_RUNNER_SOLUTION_HOOKS],
    available,
    missing,
  };
}

/**
 * List runner solutions through the runner-local solution hook.
 * @keyword-cn Solution列表, Runner数据库
 * @keyword-en solution-list, runner-db-hooks
 */
export async function listRunnerSolutions(
  hookCaller: HookCaller,
  runnerId: string,
  workflowContext: WorkflowContext | null,
): Promise<RunnerSolutionSummary[]> {
  const data = await callRunnerHookData(
    hookCaller,
    runnerId,
    'runner.app.solution.list',
    {},
    workflowContext,
  );
  return readItems(data)
    .map((item) => toRunnerSolutionSummary(item, runnerId))
    .filter((item): item is RunnerSolutionSummary => Boolean(item));
}

/**
 * Call a runner hook and unwrap the single-handler data payload.
 * @keyword-cn RunnerHook调用, Hook数据
 * @keyword-en runner-hook-call, hook-data
 */
export async function callRunnerHookData(
  hookCaller: HookCaller,
  runnerId: string,
  hookName: string,
  payload: unknown,
  workflowContext: WorkflowContext | null,
): Promise<unknown> {
  const reply = await hookCaller.callHook(runnerId, {
    hookName,
    payload,
    context: buildRunnerInvocationContext(workflowContext),
  });
  assertRunnerHookReplyOk(hookName, reply);
  if (Array.isArray(reply.result)) {
    return reply.result.length === 1 ? reply.result[0] : reply.result;
  }
  return reply.result;
}

/**
 * Build the hidden invocation context for Runner RPC calls.
 * @keyword-cn 调用上下文, RunnerHook
 * @keyword-en invocation-context, runner-hook
 */
function buildRunnerInvocationContext(workflowContext: WorkflowContext | null) {
  return {
    source: 'llm' as const,
    principalId: workflowContext?.agentPrincipalId,
    principalType: 'agent',
    extras: {
      ...(workflowContext?.sessionId
        ? { sessionId: workflowContext.sessionId }
        : {}),
      ...(workflowContext?.agentId ? { agentId: workflowContext.agentId } : {}),
    },
  };
}

/**
 * Throw a readable error when a Runner hook reply is a soft failure.
 * @keyword-cn Hook错误, RunnerHook
 * @keyword-en hook-error, runner-hook
 */
function assertRunnerHookReplyOk(
  hookName: string,
  reply: HookCallReplyLike,
): void {
  const errorMsg = reply.errorMsg ?? [];
  if (errorMsg.length > 0) {
    throw new Error(`${hookName} failed: ${errorMsg.join('; ')}`);
  }
}

/**
 * Normalize a runner solution record into the code graph summary shape.
 * @keyword-cn Solution摘要, Runner数据库
 * @keyword-en solution-summary, runner-db-hooks
 */
function toRunnerSolutionSummary(
  value: Record<string, unknown>,
  runnerId: string,
): RunnerSolutionSummary | null {
  const solutionId = readStringField(value, 'solutionId');
  const name = readStringField(value, 'name');
  if (!solutionId || !name) return null;
  const includes = Array.isArray(value.includes)
    ? value.includes.filter((item): item is string => typeof item === 'string')
    : [];
  return {
    id: solutionId,
    runnerId,
    solutionId,
    name,
    version: readStringField(value, 'version') || undefined,
    summary: readStringField(value, 'summary'),
    description: readStringField(value, 'description') || undefined,
    includes,
    isInitialized:
      typeof value.isInitialized === 'boolean'
        ? value.isInitialized
        : undefined,
  };
}
