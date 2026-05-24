import { z } from 'zod';

/**
 * @title Solution 包含类型枚举
 * @description Solution 包含内容的类型
 * @keywords-cn solution类型, 包含类型, app, unit, workflow, agent
 * @keywords-en solution-include, solution-type, app, unit, workflow, agent
 */
export const SolutionIncludeEnum = z.enum(['app', 'unit', 'workflow', 'agent']);
export type SolutionInclude = z.infer<typeof SolutionIncludeEnum>;

/**
 * @title Solution 来源枚举
 * @description Solution 的来源类型
 * @keywords-cn solution来源, 自产开发, 市场插件
 * @keywords-en solution-source, self-developed, marketplace
 */
export const SolutionSourceEnum = z.enum(['self_developed', 'marketplace']);
export type SolutionSource = z.infer<typeof SolutionSourceEnum>;

/**
 * @title Solution 信息接口
 * @description Solution 完整信息结构
 * @keywords-cn solution信息, solution结构, solution详情
 * @keywords-en solution-info, solution-structure, solution-detail
 */
export interface SolutionInfo {
  /** Solution 名称 */
  name: string;
  /** Solution 版本号 */
  version: string;
  /** Solution 来源 */
  source: SolutionSource;
  /** Runner 内绝对路径 */
  location: string;
  /** Solution 简述 */
  summary: string;
  /** Solution 详情 (markdown 格式) */
  description: string;
  /** 插件介绍图片列表 */
  images: string[];
  /** Solution 包含内容数组 */
  includes: SolutionInclude[];
  /** 安装时间 */
  installedAt?: string;
}

/**
 * @title Solution 安装请求
 * @description 安装 Solution 的请求参数
 * @keywords-cn solution安装, 安装请求, 安装参数
 * @keywords-en solution-install, install-request, install-params
 */
export const InstallSolutionSchema = z.object({
  /** Solution 名称 */
  name: z.string().min(1),
  /** Solution 版本 */
  version: z.string().min(1),
  /** Solution 来源 */
  source: SolutionSourceEnum,
  /** 安装源 URL 或路径 */
  sourceUrl: z.string(),
  /** Solution 简述 */
  summary: z.string().optional(),
  /** Solution 详情 */
  description: z.string().optional(),
  /** 图片列表 */
  images: z.array(z.string()).optional(),
  /** 包含内容 */
  includes: z.array(SolutionIncludeEnum).optional(),
});

export type InstallSolution = z.infer<typeof InstallSolutionSchema>;

/**
 * @title Solution 搜索查询
 * @description 搜索 Solution 的查询参数
 * @keywords-cn solution搜索, 搜索查询, 查询参数
 * @keywords-en solution-search, search-query, query-params
 */
export const SearchSolutionSchema = z.object({
  /** 搜索关键词 */
  q: z.string().optional(),
  /** 来源筛选 */
  source: SolutionSourceEnum.optional(),
  /** 包含类型筛选 */
  include: SolutionIncludeEnum.optional(),
});

export type SearchSolution = z.infer<typeof SearchSolutionSchema>;

/**
 * @title Solution 列表查询
 * @description Solution 列表查询参数
 * @keywords-cn solution列表, 列表查询, 分页
 * @keywords-en solution-list, list-query, pagination
 */
export const ListSolutionSchema = z.object({
  /** 页码 */
  page: z.coerce.number().int().positive().default(1),
  /** 每页数量 */
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  /** 来源筛选 */
  source: SolutionSourceEnum.optional(),
});

export type ListSolution = z.infer<typeof ListSolutionSchema>;
