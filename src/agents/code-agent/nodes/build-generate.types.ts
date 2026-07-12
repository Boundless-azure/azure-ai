import type { CodeGenOrchestrateInput } from './dependency-check.types';

/**
 * @title Build 生成上限
 * @description 约束单文件生成的手册注入规模等。工具调用轮次由 AI 层 createAgent 的递归上限内建, 不在这里控。
 * @keyword-cn 生成上限, 手册上限
 * @keyword-en build-limit, manual-limit
 */
export const BUILD_GENERATE_LIMITS = {
  maxManualChars: 8000,
  // 写整份文件的输出预算: write_file 的 content 是整个文件, 4096 兜底常被 finish=max_tokens 截断成空;
  // 给足预算 (per-call 覆盖模型默认, 见 ai-model.service.resolvedMaxTokens)。minimax 若上限更低就调小。
  generateMaxTokens: 16000,
  // 单文件内: 代码驱动的完成循环上限 (每轮一次 tool-calling 回复, 未完成按 todo 催办后重跑)
  maxGenerateRounds: 3,
  // 跨文件: 全并发跑完后按 changePlan 校验落盘, 缺文件重新触发的最多 repair 轮数
  maxRepairRounds: 3,
  // build-test: 跑 `npm run build` + LLM 判返修, 最多返修轮数 (超了还不过 → block)
  maxBuildTestRounds: 3,
  // build-test 单轮输出预算: 它不写文件、只发几个 add_repair_task, 给小预算防 reasoning 模型想太久 (慢)
  buildTestMaxTokens: 6000,
} as const;

/**
 * @title 单文件生成派发载荷 (Send 参数 / currentFile 通道)
 * @description dispatch 扇出时给每个并发代码节点打包的、生成一个文件所需的全部数据。Send 会用它替换该
 *   节点的输入 state, 所以该文件需要的一切 (planId/runnerId/需求/手册/任务/依赖兄弟摘要) 都得装进来。
 * @keyword-cn 生成派发载荷, Send参数
 * @keyword-en build-file-send, send-payload
 */
export type BuildFileSend = {
  planId: string;
  runnerId: string;
  sessionId?: string;
  appId?: string;
  requirement: string;
  input: CodeGenOrchestrateInput;
  bookIds: string[];
  manualText: string;
  task: {
    taskId: string;
    path: string;
    action?: string;
    summary?: string;
    hooks: string[];
  };
  /** create = 写新文件; modify = 就地修改已存在文件 (二次修改, 读现文件→edit_file 定点改) */
  op?: 'create' | 'modify';
  deps: Array<{ taskId: string; path?: string; summary?: string }>;
  /** 该文件参与的联动契约 (跨文件共享约定, 必须照抄其中的 id/名字/形状) */
  contracts?: Array<{ name?: string; description?: string; spec?: unknown }>;
  /** FIX 模式 (build-test 返修): 存在时表示这是对已生成文件的返修, issue 是构建判定的问题 */
  fix?: { issue: string };
};

/**
 * @title 单文件生成结果
 * @description 一个代码节点跑完后回给 join 的结果: 写没写成、多少字节、几次工具调用、规则校验结论。
 * @keyword-cn 生成结果, 文件产物
 * @keyword-en build-file-result, file-artifact
 */
export type BuildFileResult = {
  taskId: string;
  path: string;
  status: 'written' | 'failed' | 'skipped';
  bytes?: number;
  turns: number;
  validation?: BuildValidationResult;
  error?: string;
};

/**
 * @title 文件级校验结论
 * @description 完成判定②规则层的结果 (先支持 Astro; rule='none' 表示当前定型无规则可跑)。
 * @keyword-cn 校验结论, 可插拔规则
 * @keyword-en validation-result, pluggable-rule
 */
export type BuildValidationResult = {
  rule: string;
  ok: boolean;
  issues?: string[];
};
