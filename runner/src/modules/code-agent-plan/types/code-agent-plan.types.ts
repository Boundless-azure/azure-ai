import { z } from 'zod';

/**
 * @title 变更集 hook 命名空间
 * @description code-agent 变更集存储所有 hook 的公共前缀 (4 段命名: runner.app.codeAgentPlan.*)。
 * @keywords-cn 变更集命名空间, hook前缀
 * @keywords-en change-plan-namespace, hook-prefix
 * @keyword-cn 变更集命名空间, hook前缀
 * @keyword-en change-plan-namespace, hook-prefix
 */
export const CODE_AGENT_PLAN_HOOK_PREFIX = 'runner.app.codeAgentPlan' as const;

/**
 * @title 变更集 Mongo 集合名
 * @description 三个专有集合: 计划元数据 / 变更任务 (文件+hook契约节点) / 规划 todo。
 *   service 只读写这三个集合且按 planId 作用域, 不触碰其它业务数据。
 * @keywords-cn 集合名, 变更集存储
 * @keywords-en collection-names, change-plan-store
 * @keyword-cn 集合名, 变更集存储
 * @keyword-en collection-names, change-plan-store
 */
export const CODE_AGENT_PLAN_COLLECTIONS = {
  plans: 'code_agent_plans',
  tasks: 'code_agent_change_tasks',
  todos: 'code_agent_plan_todos',
} as const;

/**
 * @title 变更任务 op 枚举
 * @description 当前阶段只支持 create (新增); modify/delete 后续接入。
 * @keywords-cn 变更操作, 新增
 * @keywords-en change-op, create-only
 * @keyword-cn 变更操作, 新增
 * @keyword-en change-op, create-only
 */
export const CHANGE_TASK_OPS = ['create'] as const;
export type ChangeTaskOp = (typeof CHANGE_TASK_OPS)[number];

/**
 * @title 规划 todo 状态枚举
 * @description todo 状态机的合法状态; 代码只看这些状态判定整体是否完成。
 * @keywords-cn todo状态, 状态机
 * @keywords-en todo-status, state-machine
 * @keyword-cn todo状态, 状态机
 * @keyword-en todo-status, state-machine
 */
export const PLAN_TODO_STATUS = [
  'pending',
  'in_progress',
  'done',
  'dropped',
] as const;
export type PlanTodoStatus = (typeof PLAN_TODO_STATUS)[number];

/**
 * @title 计划元数据状态枚举
 * @description 计划整体推进状态。
 * @keywords-cn 计划状态, 推进状态
 * @keywords-en plan-status, lifecycle-status
 * @keyword-cn 计划状态, 推进状态
 * @keyword-en plan-status, lifecycle-status
 */
export const PLAN_STATUS = ['planning', 'ready', 'blocked'] as const;
export type PlanStatus = (typeof PLAN_STATUS)[number];

/**
 * @title 单个 hook 契约形状
 * @description 一个变更任务文件里声明的一个 hook: 名称 + 签名 (JSON) + 摘要 + 出边 (调用/兼容)。
 * @keywords-cn hook契约, 依赖边
 * @keywords-en hook-contract, dependency-edge
 * @keyword-cn hook契约, 依赖边
 * @keyword-en hook-contract, dependency-edge
 */
export const HookContractSchema = z.object({
  name: z.string().min(1),
  summary: z.string().optional(),
  signature: z.record(z.string(), z.unknown()).optional(),
  calls: z.array(z.string()).optional(),
  compatibleWith: z.array(z.string()).optional(),
});
export type HookContract = z.infer<typeof HookContractSchema>;

/**
 * @title 变更任务写入形状
 * @description SaaS 节点上报/局部更新一个变更任务节点 (文件 + 它声明的 hook 契约) 的字段。
 *   taskId 为逻辑主键, 配合 planId 作用域 upsert; 仅提供的字段会被 $set 合并。
 * @keywords-cn 变更任务, 局部更新
 * @keywords-en change-task, partial-upsert
 * @keyword-cn 变更任务, 局部更新
 * @keyword-en change-task, partial-upsert
 */
export const ChangeTaskInputSchema = z.object({
  taskId: z.string().min(1),
  routeId: z.string().optional(),
  targetId: z.string().optional(),
  solutionId: z.string().optional(),
  action: z.string().optional(),
  op: z.enum(CHANGE_TASK_OPS).optional(),
  path: z.string().optional(),
  summary: z.string().optional(),
  hooks: z.array(HookContractSchema).optional(),
  dependsOn: z.array(z.string()).optional(),
  reason: z.string().optional(),
});
export type ChangeTaskInput = z.infer<typeof ChangeTaskInputSchema>;

/**
 * @title 规划 todo 写入形状
 * @description SaaS 节点新增或更新一个 todo (新增与改状态共用 merge-upsert)。
 * @keywords-cn todo写入, 局部更新
 * @keywords-en todo-input, partial-upsert
 * @keyword-cn todo写入, 局部更新
 * @keyword-en todo-input, partial-upsert
 */
export const PlanTodoInputSchema = z.object({
  todoId: z.string().min(1),
  type: z.string().optional(),
  status: z.enum(PLAN_TODO_STATUS).optional(),
  refTaskId: z.string().optional(),
  refHook: z.string().optional(),
  title: z.string().optional(),
  note: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});
export type PlanTodoInput = z.infer<typeof PlanTodoInputSchema>;

/**
 * @title ensurePlan 入参
 * @description 幂等创建/读取一个计划元数据文档。
 * @keywords-cn 确保计划, 计划入参
 * @keywords-en ensure-plan, plan-payload
 * @keyword-cn 确保计划, 计划入参
 * @keyword-en ensure-plan, plan-payload
 */
export const EnsurePlanPayloadSchema = z.object({
  planId: z.string().min(1),
  sessionId: z.string().optional(),
  runnerId: z.string().optional(),
  requirement: z.string().optional(),
  solutionIds: z.array(z.string()).optional(),
  /** 计划涉及的目标根 (solutions/<sol>/apps|units|data/<name>); 让读/搜工具在规划前也能围栏到既有目标 */
  scopeRoots: z.array(z.string()).optional(),
  status: z.enum(PLAN_STATUS).optional(),
});
export type EnsurePlanPayload = z.infer<typeof EnsurePlanPayloadSchema>;

/**
 * @title upsertTasks 入参
 * @description 批量 merge-upsert 变更任务节点。
 * @keywords-cn 任务批量写, 变更集
 * @keywords-en upsert-tasks, change-plan
 * @keyword-cn 任务批量写, 变更集
 * @keyword-en upsert-tasks, change-plan
 */
export const UpsertTasksPayloadSchema = z.object({
  planId: z.string().min(1),
  tasks: z.array(ChangeTaskInputSchema).min(1),
});
export type UpsertTasksPayload = z.infer<typeof UpsertTasksPayloadSchema>;

/**
 * @title searchTasks 入参
 * @description 在某计划内按字段过滤查询变更任务 (局部搜索, 只回切片)。
 * @keywords-cn 任务搜索, 局部搜索
 * @keywords-en search-tasks, local-search
 * @keyword-cn 任务搜索, 局部搜索
 * @keyword-en search-tasks, local-search
 */
export const SearchTasksPayloadSchema = z.object({
  planId: z.string().min(1),
  taskIds: z.array(z.string()).optional(),
  routeId: z.string().optional(),
  hookName: z.string().optional(),
  limit: z.number().int().positive().max(200).optional(),
});
export type SearchTasksPayload = z.infer<typeof SearchTasksPayloadSchema>;

/**
 * @title upsertTodos 入参
 * @description 批量 merge-upsert todo (新增与改状态共用)。
 * @keywords-cn todo批量写, 状态机
 * @keywords-en upsert-todos, state-machine
 * @keyword-cn todo批量写, 状态机
 * @keyword-en upsert-todos, state-machine
 */
export const UpsertTodosPayloadSchema = z.object({
  planId: z.string().min(1),
  todos: z.array(PlanTodoInputSchema).min(1),
});
export type UpsertTodosPayload = z.infer<typeof UpsertTodosPayloadSchema>;

/**
 * @title listTodos 入参
 * @description 按状态过滤列出 todo, 驱动外循环。
 * @keywords-cn todo列表, 状态过滤
 * @keywords-en list-todos, status-filter
 * @keyword-cn todo列表, 状态过滤
 * @keyword-en list-todos, status-filter
 */
export const ListTodosPayloadSchema = z.object({
  planId: z.string().min(1),
  status: z.array(z.enum(PLAN_TODO_STATUS)).optional(),
  limit: z.number().int().positive().max(500).optional(),
});
export type ListTodosPayload = z.infer<typeof ListTodosPayloadSchema>;

/**
 * @title getSnapshot 入参
 * @description 读取计划元数据 + 计数 (开放 todo 数 / 任务数), 供完成判定。
 * @keywords-cn 计划快照, 完成判定
 * @keywords-en plan-snapshot, completion-check
 * @keyword-cn 计划快照, 完成判定
 * @keyword-en plan-snapshot, completion-check
 */
export const GetSnapshotPayloadSchema = z.object({
  planId: z.string().min(1),
});
export type GetSnapshotPayload = z.infer<typeof GetSnapshotPayloadSchema>;

/**
 * @title 计划元数据文档
 * @description code_agent_plans 集合的存储形状。
 * @keywords-cn 计划文档, 存储形状
 * @keywords-en plan-doc, stored-shape
 * @keyword-cn 计划文档, 存储形状
 * @keyword-en plan-doc, stored-shape
 */
export type CodeAgentPlanDoc = {
  planId: string;
  sessionId?: string;
  runnerId?: string;
  requirement?: string;
  solutionIds: string[];
  /** 计划涉及的目标根; 读/搜工具围栏并上它, 使规划前的分析也能访问既有目标 */
  scopeRoots?: string[];
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
};

/**
 * @title 变更任务文档
 * @description code_agent_change_tasks 集合的存储形状。
 * @keywords-cn 任务文档, 存储形状
 * @keywords-en task-doc, stored-shape
 * @keyword-cn 任务文档, 存储形状
 * @keyword-en task-doc, stored-shape
 */
export type CodeAgentChangeTaskDoc = ChangeTaskInput & {
  planId: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * @title 规划 todo 文档
 * @description code_agent_plan_todos 集合的存储形状。
 * @keywords-cn todo文档, 存储形状
 * @keywords-en todo-doc, stored-shape
 * @keyword-cn todo文档, 存储形状
 * @keyword-en todo-doc, stored-shape
 */
export type CodeAgentPlanTodoDoc = PlanTodoInput & {
  planId: string;
  status: PlanTodoStatus;
  createdAt: string;
  updatedAt: string;
};

/**
 * @title 计划快照返回
 * @description getSnapshot 的返回形状: 元数据 + 计数。
 * @keywords-cn 快照返回, 计数
 * @keywords-en snapshot-result, counts
 * @keyword-cn 快照返回, 计数
 * @keyword-en snapshot-result, counts
 */
export type CodeAgentPlanSnapshot = {
  plan: CodeAgentPlanDoc | null;
  totalTasks: number;
  openTodos: number;
  doneTodos: number;
};
