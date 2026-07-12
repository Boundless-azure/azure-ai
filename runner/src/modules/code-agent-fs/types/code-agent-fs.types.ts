import { z } from 'zod';

/**
 * @title 代码生成文件工具上限
 * @description 约束 grep/fastSearch 的遍历与返回规模, 防止大仓爆内存/超时。
 * @keyword-cn 遍历上限, 结果上限
 * @keyword-en walk-limit, result-limit
 */
export const CODE_AGENT_FS_LIMITS = {
  maxWalkFiles: 2000,
  maxGrepMatches: 200,
  maxSearchResults: 200,
  maxTextFileBytes: 512 * 1024,
  // 限定 tag 维度: 单条 @keyword 注释最多收集这么多关键词, 防词表爆维
  maxKeywordsPerLine: 5,
  // 项目初始化终端命令: 默认/最大超时 + 输出捕获上限
  defaultCommandTimeoutMs: 300_000,
  maxCommandOutputBytes: 256 * 1024,
  // searchByTag: 内置 ripgrep 快速 tag 搜索的命中上限、单个注释节点最大行数、rg 超时
  maxTagHits: 60,
  maxCommentNodeLines: 60,
  tagSearchTimeoutMs: 15_000,
} as const;

/**
 * @title writeTaskFile 入参
 * @description 按 planId+taskId 写该 task 已规划的文件; content 是文件全文。path 不由 LLM 提供 ——
 *   服务端从 task 取权威 path, 强制"生成只填已规划文件, 不即兴造文件"。
 * @keyword-cn 写任务文件入参, 权威路径
 * @keyword-en write-task-file-payload, authoritative-path
 */
export const WriteTaskFilePayloadSchema = z.object({
  planId: z.string().min(1),
  taskId: z.string().min(1),
  content: z.string(),
});
export type WriteTaskFilePayload = z.infer<typeof WriteTaskFilePayloadSchema>;

/**
 * @title editFile 入参 (按行号区间修改)
 * @description 对某 task 已规划的文件做**按行号区间**替换 (读→改→写回), path 取自 task (权威, 同 writeTaskFile,
 *   不由 LLM 提供)。每个 edit: 用 1-based 的 `startLine`..`endLine` (含端点) 指定要替换的行, 替成 `newText`
 *   (可多行; 空串=删除这些行)。行号从 readFile 的带行号输出取, 天然唯一 → 根除"子串不唯一"问题。行号越界/
 *   区间反了/多个 edit 重叠都抛错 (原子: 全成才落盘)。供 build-test 返修与 op:modify。
 * @keyword-cn 编辑文件入参, 按行编辑
 * @keyword-en edit-file-payload, line-edit
 */
export const EditFilePayloadSchema = z.object({
  planId: z.string().min(1),
  taskId: z.string().min(1),
  edits: z
    .array(
      z.object({
        startLine: z.number().int().positive(),
        endLine: z.number().int().positive(),
        newText: z.string(),
      }),
    )
    .min(1),
});
export type EditFilePayload = z.infer<typeof EditFilePayloadSchema>;

/**
 * @title readFile 入参
 * @description 读 plan 目标根内的一个文件 (workspace 相对路径), 越界即拒。可选 1-based `startLine`/`endLine`
 *   (含端点) 只读某段, 大文件按行号窗口读、避免整份灌进上下文。
 * @keyword-cn 读文件入参, 行号窗口
 * @keyword-en read-file-payload, line-window
 */
export const ReadFilePayloadSchema = z.object({
  planId: z.string().min(1),
  path: z.string().min(1),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
});
export type ReadFilePayload = z.infer<typeof ReadFilePayloadSchema>;

/**
 * @title readNode 入参 (读注释节点的代码体)
 * @description 第二层"读代码": 给定 search_by_tag 命中的 `line` (某 @keyword 行), 读它标注的整个符号代码体 —
 *   从该注释块起, 截到**下一个 @keyword 注释块之前** (或文件尾)。回带行号区间, 直接喂 edit_file。
 * @keyword-cn 读节点入参, 注释代码体
 * @keyword-en read-node-payload, node-body
 */
export const ReadNodePayloadSchema = z.object({
  planId: z.string().min(1),
  path: z.string().min(1),
  line: z.number().int().positive(),
});
export type ReadNodePayload = z.infer<typeof ReadNodePayloadSchema>;

/**
 * @title readNode 结果
 * @description 注释节点代码体 `{ path, content, startLine, endLine, totalLines }`; startLine/endLine 是该体在
 *   文件里的 1-based 行号区间, content 是那几行原文。
 * @keyword-cn 读节点结果, 注释代码体
 * @keyword-en read-node-result, node-body
 */
export type ReadNodeResult = {
  path: string;
  content: string;
  startLine: number;
  endLine: number;
  totalLines: number;
};

/**
 * @title grep 入参
 * @description 在 plan 目标根内按正则搜文件内容, 返回命中行 (path/line/text)。
 * @keyword-cn grep入参, 内容搜索
 * @keyword-en grep-payload, content-search
 */
export const GrepPayloadSchema = z.object({
  planId: z.string().min(1),
  pattern: z.string().min(1),
  flags: z.string().max(8).optional(),
  maxResults: z.number().int().positive().max(500).optional(),
});
export type GrepPayload = z.infer<typeof GrepPayloadSchema>;

/**
 * @title fastSearch 入参
 * @description 在 plan 目标根内按文件名子串快速找文件路径。
 * @keyword-cn 快搜入参, 文件名搜索
 * @keyword-en fast-search-payload, filename-search
 */
export const FastSearchPayloadSchema = z.object({
  planId: z.string().min(1),
  query: z.string().min(1),
  maxResults: z.number().int().positive().max(500).optional(),
});
export type FastSearchPayload = z.infer<typeof FastSearchPayloadSchema>;

/**
 * @title verifyTasks 入参
 * @description 按 planId 校验该 plan 每个 task 的文件是否已落盘 (存在且非空)。
 * @keyword-cn 校验入参, 落盘检查
 * @keyword-en verify-payload, materialize-check
 */
export const VerifyTasksPayloadSchema = z.object({
  planId: z.string().min(1),
});
export type VerifyTasksPayload = z.infer<typeof VerifyTasksPayloadSchema>;

/**
 * @title 落盘校验结果
 * @description present = 已落盘的 taskId; missing = 未落盘 (不存在/空/无 path) 的 task 及其 path。
 * @keyword-cn 校验结果, 缺失文件
 * @keyword-en verify-result, missing-files
 */
export type VerifyTasksResult = {
  present: string[];
  missing: Array<{ taskId: string; path: string }>;
};

/**
 * @title collectKeywords 入参
 * @description 按 planId 扫描该 plan 全部文件, 收集注释里的 @keyword 关键词。
 * @keyword-cn 收集入参, 关键词收集
 * @keyword-en collect-payload, keyword-collect
 */
export const CollectKeywordsPayloadSchema = z.object({
  planId: z.string().min(1),
});
export type CollectKeywordsPayload = z.infer<
  typeof CollectKeywordsPayloadSchema
>;

/**
 * @title 关键词收集结果
 * @description 按 appId (task.targetId) 分组的**维度化**关键词条目 (dimension + keyword), 供 SaaS 逐 app
 *   同步进 tags.json (维度归一/去重在 appTag 侧做)。
 * @keyword-cn 收集结果, 维度条目
 * @keyword-en collect-result, dimension-entries
 */
export type CollectKeywordsResult = {
  byApp: Record<string, Array<{ dimension?: string; keyword: string }>>;
};

/**
 * @title runCommand 入参
 * @description 在某 app 目录 (由 planId + 可选 appId 解析) 内跑一条终端命令 (脚手架/装依赖用)。cwd 围栏在 app 目录。
 * @keyword-cn 跑命令入参, 项目初始化
 * @keyword-en run-command-payload, project-init
 */
export const RunCommandPayloadSchema = z.object({
  planId: z.string().min(1),
  appId: z.string().optional(),
  command: z.string().min(1),
  timeoutMs: z.number().int().positive().max(600_000).optional(),
});
export type RunCommandPayload = z.infer<typeof RunCommandPayloadSchema>;

/**
 * @title 终端命令结果
 * @description 命令跑完的退出码 + 截断的 stdout/stderr + 是否超时 + 实际 cwd。
 * @keyword-cn 命令结果, 终端输出
 * @keyword-en command-result, terminal-output
 */
export type RunCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  cwd: string;
};

/**
 * @title init.lock 入参
 * @description 按 planId(+appId) 定位 app 目录, 读/写该 app 是否已初始化的 init.lock 标记文件。
 * @keyword-cn 初始化锁入参, app初始化
 * @keyword-en init-lock-payload, app-initialized
 */
export const InitLockPayloadSchema = z.object({
  planId: z.string().min(1),
  appId: z.string().optional(),
});
export type InitLockPayload = z.infer<typeof InitLockPayloadSchema>;

/**
 * @title grep 命中
 * @description 单条内容命中: 文件相对路径、行号、该行文本 (截断)。
 * @keyword-cn grep命中, 内容命中
 * @keyword-en grep-match, content-hit
 */
export type GrepMatch = {
  path: string;
  line: number;
  text: string;
};

/**
 * @title searchByTag 入参
 * @description 用内置 ripgrep 在 `path` (须在 plan 目标根内) 下按注释 @keyword `tag` 反查关联文件。tag 必须
 *   是该 app `tags.json` 里已声明的词; 未声明则不搜, 返回可用词表让 LLM 改用真实 tag (先声明后搜、不编造)。
 * @keyword-cn 标签搜索入参, 反查关联文件
 * @keyword-en search-by-tag-payload, reverse-lookup
 */
export const SearchByTagPayloadSchema = z.object({
  planId: z.string().min(1),
  path: z.string().min(1),
  tag: z.string().min(1),
  maxResults: z.number().int().positive().max(200).optional(),
});
export type SearchByTagPayload = z.infer<typeof SearchByTagPayloadSchema>;

/**
 * @title tag 关联注释节点命中
 * @description 一条命中: 文件相对路径、@keyword 所在行号、展开出的整个注释节点 (含被注释声明片段)。
 * @keyword-cn 标签命中, 注释节点
 * @keyword-en tag-hit, comment-node
 */
export type TagHit = {
  path: string;
  line: number;
  node: string;
};

/**
 * @title searchByTag 结果
 * @description declared=false 时表示 tag 未在 tags.json 声明, 附 message + availableTags (已声明词表) 引导
 *   LLM 改用真实 tag; declared=true 时附 hits (关联文件 + 注释节点)。
 * @keyword-cn 标签搜索结果, 门控引导
 * @keyword-en search-by-tag-result, gate-guidance
 */
export type SearchByTagResult = {
  tag: string;
  declared: boolean;
  message?: string;
  availableTags?: Record<string, string[]>;
  hits?: TagHit[];
};
