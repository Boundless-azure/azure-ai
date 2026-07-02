import z from 'zod';
import { CODE_GRAPH_ACTION_VALUES } from './dependency-check.types';

/**
 * @title Change-plan todo status values
 * @description Todo state-machine values; mirrors the Runner code-agent-plan store enum.
 * @keyword-cn todo状态, 状态机
 * @keyword-en todo-status, state-machine
 */
export const CHANGE_PLAN_TODO_STATUS = [
  'pending',
  'in_progress',
  'done',
  'dropped',
] as const;
export type ChangePlanTodoStatus = (typeof CHANGE_PLAN_TODO_STATUS)[number];

/**
 * @title Change-plan todo types
 * @description Kinds of planning work units the code-driven loop tracks.
 *   plan-target: decide create files/hooks for one target; resolve-edge: ground an unresolved
 *   call/compatible edge; fix-validation: repair a validation issue.
 * @keyword-cn todo类型, 规划工作单元
 * @keyword-en todo-type, planning-work-unit
 */
export const CHANGE_PLAN_TODO_TYPES = [
  'plan-target',
  'resolve-edge',
  'fix-validation',
] as const;
export type ChangePlanTodoType = (typeof CHANGE_PLAN_TODO_TYPES)[number];

/**
 * @title Change-plan loop limits
 * @description Hard caps that bound the code-driven outer loop cost and search breadth.
 * @keyword-cn 循环上限, 搜索上限
 * @keyword-en loop-limit, search-limit
 */
export const CHANGE_PLAN_LIMITS = {
  maxIterations: 12,
  maxSearchRequestsPerTurn: 4,
  existingHookSearchLimit: 60,
} as const;

/**
 * @title Existing hook summary
 * @description One existing runner hook discovered by scoped search, used to ground new→existing edges.
 * @keyword-cn 存量hook摘要, 边解析
 * @keyword-en existing-hook-summary, edge-resolution
 */
export type ExistingHookSummary = {
  name: string;
  description?: string;
  signature?: unknown;
  solutionId?: string;
};

/**
 * @title SaaS hook bus (minimal)
 * @description Minimal SaaS HookBus shape the change-plan node needs to read knowledge books.
 * @keyword-cn SaaSHook总线, 知识读取
 * @keyword-en saas-hook-bus, knowledge-read
 */
export type SaasHookBusLike = {
  select(name: string): unknown[];
  emit(event: {
    name: string;
    payload?: unknown;
    context?: {
      source?: 'llm' | 'system' | 'http' | 'runner';
      principalId?: string;
      principalType?: string;
      extras?: Record<string, unknown>;
    };
  }): Promise<Array<{ status?: string; data?: unknown; error?: string }>>;
};

/**
 * @title Selected knowledge manuals
 * @description Books chosen for this plan plus their assembled chapter text fed into generation.
 * @keyword-cn 选用书本, 手册文本
 * @keyword-en selected-books, manual-text
 */
export type SelectedManuals = {
  bookIds: string[];
  manualText: string;
  /** 面向用户的本地化告知文案：选用了哪本手册/按什么规范来搭 (语言跟随需求) */
  notice?: string;
};

const HookContractInputSchema = z.object({
  name: z.string().min(1),
  summary: z.string().optional(),
  signature: z.unknown().optional(),
  calls: z.array(z.string()).optional(),
  compatibleWith: z.array(z.string()).optional(),
});

const ChangeTaskInputSchema = z.object({
  taskId: z.string().optional(),
  routeId: z.string().optional(),
  targetId: z.string().optional(),
  solutionId: z.string().optional(),
  action: z.enum(CODE_GRAPH_ACTION_VALUES).optional(),
  path: z.string().min(1),
  summary: z.string().optional(),
  hooks: z.array(HookContractInputSchema).optional(),
  dependsOn: z.array(z.string()).optional(),
  reason: z.string().optional(),
});

const TodoUpdateInputSchema = z.object({
  todoId: z.string().min(1),
  status: z.enum(CHANGE_PLAN_TODO_STATUS),
  note: z.string().optional(),
});

const TodoAddInputSchema = z.object({
  todoId: z.string().min(1),
  type: z.enum(CHANGE_PLAN_TODO_TYPES).optional(),
  title: z.string().optional(),
  refTaskId: z.string().optional(),
  refHook: z.string().optional(),
});

const SearchRequestInputSchema = z.object({
  query: z.string().min(1),
  solutionId: z.string().optional(),
});

/**
 * @title Change-plan LLM turn payload
 * @description Strict JSON one outer-loop turn must return: new/updated tasks, todo state changes,
 *   existing-hook search requests, and an optional user notice. Code executes all of it.
 * @keyword-cn LLM动作payload, 变更集
 * @keyword-en llm-turn-payload, change-plan
 */
export const ChangePlanTurnSchema = z.object({
  tasks: z.array(ChangeTaskInputSchema).optional(),
  todoUpdates: z.array(TodoUpdateInputSchema).optional(),
  todoAdds: z.array(TodoAddInputSchema).optional(),
  searchRequests: z.array(SearchRequestInputSchema).optional(),
  notice: z.string().optional(),
});

export type ChangePlanTurnPayload = z.infer<typeof ChangePlanTurnSchema>;
export type ChangePlanTaskInput = z.infer<typeof ChangeTaskInputSchema>;
export type ChangePlanTodoUpdateInput = z.infer<typeof TodoUpdateInputSchema>;
export type ChangePlanTodoAddInput = z.infer<typeof TodoAddInputSchema>;
export type ChangePlanSearchRequestInput = z.infer<
  typeof SearchRequestInputSchema
>;
