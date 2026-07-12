import { readItems, readStringField } from './dependency-check-context';
import { callRunnerHookData } from './dependency-check-runner-hooks';
import {
  CHANGE_PLAN_LIMITS,
  type ExistingHookSummary,
} from './change-plan.types';
import type {
  CodeGraphChangeTask,
  HookCaller,
  WorkflowContext,
} from './dependency-check.types';

type StoreArgs = {
  hookCaller: HookCaller;
  runnerId: string;
  workflowContext: WorkflowContext | null;
};

type PlanTodoRecord = {
  todoId: string;
  type?: string;
  status: string;
  title?: string;
  note?: string;
  refTaskId?: string;
  refHook?: string;
};

type PlanSnapshot = {
  totalTasks: number;
  openTodos: number;
  doneTodos: number;
  status?: string;
};

/**
 * @title Change-plan store client
 * @description Thin SaaS-side wrapper over the Runner `runner.app.codeAgentPlan.*` business hooks.
 *   Every method addresses the durable Mongo-backed plan by planId; the big plan never lives in
 *   SaaS memory and is read back only as slices. Writes never bypass denyLlm — the Runner business
 *   service owns the raw Mongo access.
 * @keyword-cn 变更集存储客户端, planId作用域
 * @keyword-en change-plan-store-client, plan-scoped
 */
export class ChangePlanStore {
  constructor(private readonly args: StoreArgs) {}

  /**
   * Idempotently create or read the plan metadata document.
   * @keyword-cn 确保计划, 幂等
   * @keyword-en ensure-plan, idempotent
   */
  async ensurePlan(payload: {
    planId: string;
    sessionId?: string;
    runnerId?: string;
    requirement?: string;
    solutionIds?: string[];
    scopeRoots?: string[];
  }): Promise<void> {
    await this.call('runner.app.codeAgentPlan.ensurePlan', payload);
  }

  /**
   * Batch merge-upsert change tasks (file + hook contracts) under one plan.
   * @keyword-cn 任务批量写, 局部更新
   * @keyword-en upsert-tasks, partial-upsert
   */
  async upsertTasks(
    planId: string,
    tasks: CodeGraphChangeTask[],
  ): Promise<void> {
    if (tasks.length === 0) return;
    await this.call('runner.app.codeAgentPlan.upsertTasks', { planId, tasks });
  }

  /**
   * Search change tasks within one plan by ids / route / hook name (slice only).
   * @keyword-cn 任务搜索, 局部搜索
   * @keyword-en search-tasks, local-search
   */
  async searchTasks(
    planId: string,
    filter: {
      taskIds?: string[];
      routeId?: string;
      hookName?: string;
      limit?: number;
    },
  ): Promise<CodeGraphChangeTask[]> {
    const data = await this.call('runner.app.codeAgentPlan.searchTasks', {
      planId,
      ...filter,
    });
    return readItems(data).map((item) => normalizeStoredTask(item));
  }

  /**
   * Batch merge-upsert plan todos (add and status-update share this).
   * @keyword-cn todo批量写, 状态机
   * @keyword-en upsert-todos, state-machine
   */
  async upsertTodos(
    planId: string,
    todos: Array<Record<string, unknown>>,
  ): Promise<void> {
    if (todos.length === 0) return;
    await this.call('runner.app.codeAgentPlan.upsertTodos', { planId, todos });
  }

  /**
   * List plan todos filtered by status, driving the outer loop.
   * @keyword-cn todo列表, 状态过滤
   * @keyword-en list-todos, status-filter
   */
  async listTodos(
    planId: string,
    status?: string[],
  ): Promise<PlanTodoRecord[]> {
    const data = await this.call('runner.app.codeAgentPlan.listTodos', {
      planId,
      ...(status && status.length > 0 ? { status } : {}),
    });
    return readItems(data).map((item) => ({
      todoId: readStringField(item, 'todoId'),
      type: readStringField(item, 'type') || undefined,
      status: readStringField(item, 'status') || 'pending',
      title: readStringField(item, 'title') || undefined,
      note: readStringField(item, 'note') || undefined,
      refTaskId: readStringField(item, 'refTaskId') || undefined,
      refHook: readStringField(item, 'refHook') || undefined,
    }));
  }

  /**
   * Read plan metadata + counts for the code-driven completion check.
   * @keyword-cn 计划快照, 完成判定
   * @keyword-en plan-snapshot, completion-check
   */
  async getSnapshot(planId: string): Promise<PlanSnapshot> {
    const data = await this.call('runner.app.codeAgentPlan.getSnapshot', {
      planId,
    });
    const record =
      data && typeof data === 'object' && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {};
    const plan =
      record.plan && typeof record.plan === 'object'
        ? (record.plan as Record<string, unknown>)
        : null;
    return {
      totalTasks: readNumberField(record, 'totalTasks'),
      openTodos: readNumberField(record, 'openTodos'),
      doneTodos: readNumberField(record, 'doneTodos'),
      status: plan ? readStringField(plan, 'status') || undefined : undefined,
    };
  }

  /**
   * Call one runner code-agent-plan hook and unwrap its data.
   * @keyword-cn RunnerHook调用, 变更集存储
   * @keyword-en runner-hook-call, change-plan-store
   */
  private async call(hookName: string, payload: unknown): Promise<unknown> {
    return callRunnerHookData(
      this.args.hookCaller,
      this.args.runnerId,
      hookName,
      payload,
      this.args.workflowContext,
    );
  }
}

/**
 * Search existing runner hooks scoped to the routePlan solutions' apps/units.
 * @keyword-cn 存量hook搜索, 边解析
 * @keyword-en existing-hook-search, edge-resolution
 */
export async function searchSolutionHooks(args: {
  hookCaller: HookCaller;
  runnerId: string;
  workflowContext: WorkflowContext | null;
  scopeNames: string[];
  query: string;
}): Promise<ExistingHookSummary[]> {
  const scope = args.scopeNames
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  // 新 Solution 没有任何 app/unit, 也就没有存量 hook 可解析 —— 直接空集, 不发无谓搜索。
  if (scope.length === 0) return [];

  const searchData = await callRunnerHookData(
    args.hookCaller,
    args.runnerId,
    'runner.system.hookbus.search',
    [{ isWeb: false, limit: CHANGE_PLAN_LIMITS.existingHookSearchLimit }],
    args.workflowContext,
  );
  const candidates = readItems(searchData)
    .map((item) => readStringField(item, 'name'))
    .filter(Boolean);
  const scoped = candidates.filter((name) => {
    const lower = name.toLowerCase();
    return scope.some((scopeName) => lower.includes(scopeName));
  });
  if (scoped.length === 0) return [];

  const tokens = args.query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);
  const ranked = scoped
    .map((name) => ({
      name,
      score: tokens.reduce(
        (acc, token) => acc + (name.toLowerCase().includes(token) ? 1 : 0),
        0,
      ),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)
    .map((item) => item.name);
  if (ranked.length === 0) return [];

  const infoData = await callRunnerHookData(
    args.hookCaller,
    args.runnerId,
    'runner.system.hookbus.getInfo',
    [{ hookNames: ranked }],
    args.workflowContext,
  );
  return readItems(infoData).map((item) => ({
    name: readStringField(item, 'name'),
    description: readStringField(item, 'description') || undefined,
    signature: item.payloadSchema ?? undefined,
  }));
}

/**
 * Normalize a stored change-task hook row into the graph change-task shape.
 * @keyword-cn 任务归一化, 变更任务
 * @keyword-en task-normalize, change-task
 */
function normalizeStoredTask(
  value: Record<string, unknown>,
): CodeGraphChangeTask {
  const hooksRaw = Array.isArray(value.hooks) ? value.hooks : [];
  const hooks = hooksRaw
    .filter(
      (hook): hook is Record<string, unknown> =>
        Boolean(hook) && typeof hook === 'object' && !Array.isArray(hook),
    )
    .map((hook) => ({
      name: readStringField(hook, 'name'),
      summary: readStringField(hook, 'summary') || undefined,
      signature:
        hook.signature && typeof hook.signature === 'object'
          ? (hook.signature as Record<string, unknown>)
          : undefined,
      calls: readStringArray(hook.calls),
      compatibleWith: readStringArray(hook.compatibleWith),
    }))
    .filter((hook) => Boolean(hook.name));
  const action = readStringField(value, 'action');
  const dependsOn = readStringArray(value.dependsOn);
  return {
    taskId: readStringField(value, 'taskId'),
    routeId: readStringField(value, 'routeId') || undefined,
    targetId: readStringField(value, 'targetId') || undefined,
    solutionId: readStringField(value, 'solutionId') || undefined,
    ...(action ? { action: action as CodeGraphChangeTask['action'] } : {}),
    op: readStringField(value, 'op') === 'modify' ? 'modify' : 'create',
    path: readStringField(value, 'path'),
    summary: readStringField(value, 'summary') || undefined,
    hooks,
    ...(dependsOn ? { dependsOn } : {}),
    ...(readStringArray(value.chapters)
      ? { chapters: readStringArray(value.chapters) }
      : {}),
    reason: readStringField(value, 'reason') || undefined,
  };
}

/**
 * Read a string array field, dropping non-string and empty entries.
 * @keyword-cn 字段读取, 字符串数组
 * @keyword-en field-read, string-array
 */
function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter(
    (item): item is string => typeof item === 'string' && item.trim() !== '',
  );
  return items.length > 0 ? items : undefined;
}

/**
 * Read a numeric field from an unknown hook record, defaulting to 0.
 * @keyword-cn 字段读取, 数值
 * @keyword-en field-read, number-field
 */
function readNumberField(
  value: Record<string, unknown>,
  field: string,
): number {
  const raw = value[field];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}
