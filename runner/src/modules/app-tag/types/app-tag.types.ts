import { z } from 'zod';

/**
 * @title App 关键词文件名
 * @description 每个 app 目录顶层存放维度化关键词词表的文件名 (随 app 分发)。
 * @keyword-cn 词表文件, app目录
 * @keyword-en tag-file, app-dir
 */
export const APP_TAG_FILE = 'tags.json';

/**
 * @title 关键词维度集 (工程向 4 维)
 * @description LLM 构建注释关键词时沿的固定视角: 功能职责 / 技术栈 / 数据接口 / 依赖关系。每维带别名,
 *   用于把 LLM 写的维度前缀归一到 canonical key; 不在集内的归 `其他`。这就是"限定 tag 维度"。
 * @keyword-cn 关键词维度, 工程4维
 * @keyword-en keyword-dimensions, four-facets
 */
export const KEYWORD_DIMENSIONS = [
  {
    key: '功能职责',
    aliases: ['功能职责', '功能', '职责', 'responsibility', 'function', 'func', 'role'],
  },
  {
    key: '技术栈',
    aliases: ['技术栈', '技术', '栈', 'tech', 'tech-stack', 'stack', 'technology'],
  },
  {
    key: '数据接口',
    aliases: ['数据接口', '数据', '接口', 'data', 'interface', 'api', 'schema'],
  },
  {
    key: '依赖关系',
    aliases: ['依赖关系', '依赖', 'dependency', 'dependencies', 'deps', 'dep', 'depends'],
  },
] as const;

export const KEYWORD_DIMENSION_KEYS: string[] = KEYWORD_DIMENSIONS.map(
  (d) => d.key,
);
export const KEYWORD_DIMENSION_OTHER = '其他';

const DIM_ALIAS_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const dim of KEYWORD_DIMENSIONS) {
    for (const alias of dim.aliases) map[alias.toLowerCase()] = dim.key;
  }
  return map;
})();

/**
 * 把 LLM 写的维度前缀归一到 canonical 维度 key; 不认识的归 `其他`。
 * @keyword-cn 维度归一, 兜底其他
 * @keyword-en canonical-dimension, other-fallback
 */
export function canonicalDimension(raw: string | undefined): string {
  return DIM_ALIAS_MAP[(raw ?? '').trim().toLowerCase()] ?? KEYWORD_DIMENSION_OTHER;
}

/**
 * @title 维度化关键词词表
 * @description tags.json 的存储形状: 维度 key → 该维度下的关键词纯词数组。
 * @keyword-cn 词表形状, 维度分组
 * @keyword-en keyword-store, dimension-grouped
 */
export type AppKeywordStore = Record<string, string[]>;

/**
 * @title getList 入参
 * @description 按 appId 读取该 app 的维度化关键词词表。
 * @keyword-cn 词表读取入参, appId
 * @keyword-en list-payload, app-id
 */
export const GetAppTagListPayloadSchema = z.object({
  appId: z.string().min(1),
});
export type GetAppTagListPayload = z.infer<typeof GetAppTagListPayloadSchema>;

/**
 * @title 关键词条目
 * @description 一个维度 + 一个关键词纯词; 维度缺省/不认识归 `其他`。
 * @keyword-cn 关键词条目, 维度词
 * @keyword-en keyword-entry, dimension-term
 */
export const KeywordEntrySchema = z.object({
  dimension: z.string().optional(),
  keyword: z.string().min(1),
});
export type KeywordEntry = z.infer<typeof KeywordEntrySchema>;

/**
 * @title ensure 入参
 * @description 幂等新增一个维度化关键词 (LLM add_keyword 用): 按 (维度, 归一化词) 去重。
 * @keyword-cn 单条写入参, 幂等
 * @keyword-en ensure-payload, idempotent
 */
export const EnsureAppTagPayloadSchema = z.object({
  appId: z.string().min(1),
  dimension: z.string().optional(),
  keyword: z.string().min(1),
});
export type EnsureAppTagPayload = z.infer<typeof EnsureAppTagPayloadSchema>;

/**
 * @title ensureMany 入参
 * @description 批量把收集的维度化关键词同步进 tags.json: 逐条归一维度 + 去重, 只加缺的。
 * @keyword-cn 批量写入参, 关键词同步
 * @keyword-en ensure-many-payload, keyword-sync
 */
export const EnsureManyPayloadSchema = z.object({
  appId: z.string().min(1),
  entries: z.array(KeywordEntrySchema),
});
export type EnsureManyPayload = z.infer<typeof EnsureManyPayloadSchema>;

/**
 * @title search 入参
 * @description 在某 app 词表内按 query 跨维度子串搜索。
 * @keyword-cn 搜索入参, 快速搜索
 * @keyword-en search-payload, fast-search
 */
export const SearchAppTagsPayloadSchema = z.object({
  appId: z.string().min(1),
  query: z.string().optional(),
  limit: z.number().int().positive().max(200).optional(),
});
export type SearchAppTagsPayload = z.infer<typeof SearchAppTagsPayloadSchema>;
