import type { Collection, Db } from 'mongodb';
import {
  CODE_AGENT_PLAN_COLLECTIONS,
  type CodeAgentChangeTaskDoc,
  type CodeAgentPlanDoc,
  type CodeAgentPlanSnapshot,
  type CodeAgentPlanTodoDoc,
  type EnsurePlanPayload,
  type GetSnapshotPayload,
  type ListTodosPayload,
  type SearchTasksPayload,
  type UpsertTasksPayload,
  type UpsertTodosPayload,
} from '../types/code-agent-plan.types';

const OPEN_TODO_STATUS = ['pending', 'in_progress'] as const;

/**
 * 删除对象里值为 undefined 的键, 避免 $set 把已有字段覆盖成 undefined。
 * @keyword-en strip-undefined, mongo-set
 */
function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) out[key] = item;
  }
  return out as T;
}

/**
 * @title Runner 变更集存储服务
 * @description code-agent 变更集 (changePlan) 的专有持久化服务。只读写 code_agent_plans /
 *   code_agent_change_tasks / code_agent_plan_todos 三个集合, 一切操作按 planId 作用域,
 *   不触碰其它业务数据。通过原生 Mongo Db 直接读写, 是 mongo denyLlm 写 hook 的合法业务出口。
 * @keywords-cn 变更集服务, 专有存储, planId作用域
 * @keywords-en change-plan-service, dedicated-store, plan-scoped
 * @keyword-cn 变更集服务, 专有存储, planId作用域
 * @keyword-en change-plan-service, dedicated-store, plan-scoped
 */
export class RunnerCodeAgentPlanService {
  private plans: Collection<CodeAgentPlanDoc>;
  private tasks: Collection<CodeAgentChangeTaskDoc>;
  private todos: Collection<CodeAgentPlanTodoDoc>;

  constructor(private readonly db: Db) {
    this.plans = db.collection<CodeAgentPlanDoc>(
      CODE_AGENT_PLAN_COLLECTIONS.plans,
    );
    this.tasks = db.collection<CodeAgentChangeTaskDoc>(
      CODE_AGENT_PLAN_COLLECTIONS.tasks,
    );
    this.todos = db.collection<CodeAgentPlanTodoDoc>(
      CODE_AGENT_PLAN_COLLECTIONS.todos,
    );
  }

  /**
   * 幂等创建/读取一个计划元数据文档; 已存在则只回写提供的元字段并返回最新。
   * @keyword-cn 确保计划, 幂等
   * @keyword-en ensure-plan, idempotent
   */
  async ensurePlan(payload: EnsurePlanPayload): Promise<CodeAgentPlanDoc> {
    const now = new Date().toISOString();
    const set = stripUndefined({
      sessionId: payload.sessionId,
      runnerId: payload.runnerId,
      requirement: payload.requirement,
      solutionIds: payload.solutionIds,
      scopeRoots: payload.scopeRoots,
      status: payload.status,
      updatedAt: now,
    });
    await this.plans.updateOne(
      { planId: payload.planId },
      {
        $set: set,
        $setOnInsert: {
          planId: payload.planId,
          createdAt: now,
          ...(payload.status ? {} : { status: 'planning' }),
          ...(payload.solutionIds ? {} : { solutionIds: [] }),
        },
      } as never,
      { upsert: true },
    );
    const doc = await this.plans.findOne(
      { planId: payload.planId },
      { projection: { _id: 0 } },
    );
    return (doc as CodeAgentPlanDoc | null) ?? this.fallbackPlan(payload, now);
  }

  /**
   * 读某计划声明的目标根 (scopeRoots); 供 fs 层围栏并上, 使规划前的分析也能访问既有目标 (无 task 也不空)。
   * @keyword-cn 读目标根, 计划围栏
   * @keyword-en get-scope-roots, plan-scope
   */
  async getScopeRoots(planId: string): Promise<string[]> {
    const doc = await this.plans.findOne(
      { planId },
      { projection: { _id: 0, scopeRoots: 1 } },
    );
    const roots = (doc as { scopeRoots?: unknown } | null)?.scopeRoots;
    return Array.isArray(roots)
      ? roots.filter((r): r is string => typeof r === 'string')
      : [];
  }

  /**
   * 批量 merge-upsert 变更任务节点 (按 planId + taskId 作用域); 仅提供的字段被 $set。
   * @keyword-cn 任务批量写, 局部更新
   * @keyword-en upsert-tasks, partial-upsert
   */
  async upsertTasks(payload: UpsertTasksPayload): Promise<{ count: number }> {
    const now = new Date().toISOString();
    const ops = payload.tasks.map((task) => {
      const set = stripUndefined({ ...task, planId: payload.planId, updatedAt: now });
      return {
        updateOne: {
          filter: { planId: payload.planId, taskId: task.taskId },
          update: {
            $set: set,
            $setOnInsert: { createdAt: now },
          },
          upsert: true,
        },
      };
    });
    await this.tasks.bulkWrite(
      ops as Parameters<typeof this.tasks.bulkWrite>[0],
    );
    return { count: payload.tasks.length };
  }

  /**
   * 在某计划内按 taskIds / routeId / hookName 过滤查询变更任务 (局部搜索, 只回切片)。
   * @keyword-cn 任务搜索, 局部搜索
   * @keyword-en search-tasks, local-search
   */
  async searchTasks(
    payload: SearchTasksPayload,
  ): Promise<CodeAgentChangeTaskDoc[]> {
    const filter: Record<string, unknown> = { planId: payload.planId };
    if (payload.taskIds && payload.taskIds.length > 0) {
      filter.taskId = { $in: payload.taskIds };
    }
    if (payload.routeId) filter.routeId = payload.routeId;
    if (payload.hookName) filter['hooks.name'] = payload.hookName;
    const cursor = this.tasks
      .find(filter, { projection: { _id: 0 } })
      .limit(payload.limit ?? 200);
    return (await cursor.toArray()) as CodeAgentChangeTaskDoc[];
  }

  /**
   * 批量 merge-upsert todo (新增与改状态共用; 按 planId + todoId 作用域)。
   * @keyword-cn todo批量写, 状态机
   * @keyword-en upsert-todos, state-machine
   */
  async upsertTodos(payload: UpsertTodosPayload): Promise<{ count: number }> {
    const now = new Date().toISOString();
    const ops = payload.todos.map((todo) => {
      const set = stripUndefined({ ...todo, planId: payload.planId, updatedAt: now });
      return {
        updateOne: {
          filter: { planId: payload.planId, todoId: todo.todoId },
          update: {
            $set: set,
            $setOnInsert: {
              createdAt: now,
              ...(todo.status ? {} : { status: 'pending' }),
            },
          },
          upsert: true,
        },
      };
    });
    await this.todos.bulkWrite(
      ops as Parameters<typeof this.todos.bulkWrite>[0],
    );
    return { count: payload.todos.length };
  }

  /**
   * 按状态过滤列出某计划的 todo, 驱动外循环。
   * @keyword-cn todo列表, 状态过滤
   * @keyword-en list-todos, status-filter
   */
  async listTodos(payload: ListTodosPayload): Promise<CodeAgentPlanTodoDoc[]> {
    const filter: Record<string, unknown> = { planId: payload.planId };
    if (payload.status && payload.status.length > 0) {
      filter.status = { $in: payload.status };
    }
    const cursor = this.todos
      .find(filter, { projection: { _id: 0 } })
      .limit(payload.limit ?? 500);
    return (await cursor.toArray()) as CodeAgentPlanTodoDoc[];
  }

  /**
   * 读取计划元数据 + 计数 (任务总数 / 开放 todo 数 / 已完成 todo 数), 供完成判定。
   * @keyword-cn 计划快照, 完成判定
   * @keyword-en plan-snapshot, completion-check
   */
  async getSnapshot(
    payload: GetSnapshotPayload,
  ): Promise<CodeAgentPlanSnapshot> {
    const [plan, totalTasks, openTodos, doneTodos] = await Promise.all([
      this.plans.findOne(
        { planId: payload.planId },
        { projection: { _id: 0 } },
      ),
      this.tasks.countDocuments({ planId: payload.planId }),
      this.todos.countDocuments({
        planId: payload.planId,
        status: { $in: [...OPEN_TODO_STATUS] },
      }),
      this.todos.countDocuments({
        planId: payload.planId,
        status: 'done',
      }),
    ]);
    return {
      plan: (plan as CodeAgentPlanDoc | null) ?? null,
      totalTasks,
      openTodos,
      doneTodos,
    };
  }

  /**
   * ensurePlan 读回失败时的内存兜底文档 (不落库, 仅保证返回形状)。
   * @keyword-cn 计划兜底, 形状保证
   * @keyword-en plan-fallback, shape-guarantee
   */
  private fallbackPlan(
    payload: EnsurePlanPayload,
    now: string,
  ): CodeAgentPlanDoc {
    return {
      planId: payload.planId,
      ...(payload.sessionId ? { sessionId: payload.sessionId } : {}),
      ...(payload.runnerId ? { runnerId: payload.runnerId } : {}),
      ...(payload.requirement ? { requirement: payload.requirement } : {}),
      solutionIds: payload.solutionIds ?? [],
      status: payload.status ?? 'planning',
      createdAt: now,
      updatedAt: now,
    };
  }
}
