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
 *   call/compatible edge; fix-validation: repair a validation issue; contract-review: a code-forced
 *   dedicated pass to declare cross-file coupling contracts once files are planned.
 * @keyword-cn todo类型, 规划工作单元
 * @keyword-en todo-type, planning-work-unit
 */
export const CHANGE_PLAN_TODO_TYPES = [
  'analyze-target',
  'plan-target',
  'resolve-edge',
  'fix-validation',
  'generate-file',
  'contract-review',
] as const;
export type ChangePlanTodoType = (typeof CHANGE_PLAN_TODO_TYPES)[number];

/**
 * @title Change-plan loop limits
 * @description Hard caps that bound the code-driven outer loop cost and search breadth.
 * @keyword-cn 循环上限, 搜索上限
 * @keyword-en loop-limit, search-limit
 */
export const CHANGE_PLAN_LIMITS = {
  // code 驱动外循环的最大轮数 (每轮 = 一次 LLM 工具调用 + code 重算边)
  maxIterations: 12,
  existingHookSearchLimit: 60,
  // 单轮工具调用的输出预算: 一轮可能 upsert 很多文件 (每个一次 tool call), 4096 兜底会截断; per-call 覆盖模型默认
  maxTokens: 16000,
  // #4 瘦 prompt: 后续(非首轮/非分析轮)只发手册开头这么多字符 (LM必读要义), 不每轮重发整份
  laterRoundManualChars: 2000,
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
  /** 选中书本的章节目录 (id+title); change-plan 让 LLM 按文件选章, dispatch 按选中章加载正文 */
  chapters?: Array<{ id: string; title: string }>;
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

/**
 * @title upsert_task tool input
 * @description `upsert_task` 工具的入参 = 要创建的一个新文件 (create-only)。unit 文件带其 hook 契约;
 *   复用同一 taskId 即更新。不再是"大 JSON 一次返回", 而是 LLM 逐个调用工具构建。
 * @keyword-cn 任务工具入参, 变更任务
 * @keyword-en task-tool-input, change-task
 */
export const ChangeTaskInputSchema = z.object({
  taskId: z.string().optional(),
  routeId: z.string().optional(),
  targetId: z.string().optional(),
  solutionId: z.string().optional(),
  action: z.enum(CODE_GRAPH_ACTION_VALUES).optional(),
  /** create = 新建文件 (默认); modify = 就地修改一个已存在的文件 (二次修改, 用 search_by_tag 先定位) */
  op: z.enum(['create', 'modify']).optional(),
  path: z.string().min(1),
  summary: z.string().optional(),
  hooks: z.array(HookContractInputSchema).optional(),
  dependsOn: z.array(z.string()).optional(),
  /** 生成本文件时要参考的手册章节 id (从 targets 上方的 chapter catalog 里挑; 只选真正相关的, 别全选) */
  chapters: z.array(z.string()).optional(),
  reason: z.string().optional(),
});

/**
 * @title declare_contract tool input
 * @description `declare_contract` 工具的入参 = 一份跨文件共享约定 (锚点id/事件名/共享class/payload 形状…),
 *   挂在参与的 taskIds 上; spec 写协定好的具体值/名字/形状, 生成时注入每个参与文件。
 * @keyword-cn 契约工具入参, 联动契约
 * @keyword-en contract-tool-input, coupling-contract
 */
export const ContractInputSchema = z.object({
  contractId: z.string().min(1),
  name: z.string().optional(),
  // 契约以**文字说明**承载 (description): 把锚点/id/形状等确定值写进这句话即可, 不必再生成 JSON spec
  description: z.string().optional(),
  spec: z.unknown().optional(),
  // 所有 generate-file 节点默认读全部契约, 无需列 party taskIds (保留可选, 仅作可读性备注)
  taskIds: z.array(z.string()).optional(),
});

/**
 * @title record_analysis tool input
 * @description `record_analysis` 工具的入参 = 对一个既有 (二次修改) 目标的**分析结论**: 把需求拆成若干变更意图
 *   (intent), 每个意图指向经代码搜索**定位到的既有文件** (files) + 一句判断 (note)。规划 modify 前的强制产物。
 * @keyword-cn 分析结论入参, 需求代码分析
 * @keyword-en record-analysis-input, requirement-code-analysis
 */
export const RecordAnalysisInputSchema = z.object({
  routeId: z.string().optional(),
  findings: z
    .array(
      z.object({
        intent: z.string().min(1),
        files: z.array(z.string()).optional(),
        note: z.string().optional(),
      }),
    )
    .min(1),
});
export type RecordAnalysisInput = z.infer<typeof RecordAnalysisInputSchema>;

/**
 * @title Analysis finding
 * @description 一条落库的分析结论: 一个变更意图 + 定位到的既有文件 + 判断; 注入 plan-target 提示让规划有据。
 * @keyword-cn 分析结论, 变更意图
 * @keyword-en analysis-finding, change-intent
 */
export type AnalysisFinding = {
  intent: string;
  files: string[];
  note?: string;
};

export type ChangePlanTaskInput = z.infer<typeof ChangeTaskInputSchema>;
export type ContractInput = z.infer<typeof ContractInputSchema>;
