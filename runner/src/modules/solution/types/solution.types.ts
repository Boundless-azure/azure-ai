import { z } from 'zod';

/**
 * @title Solution 包含类型枚举
 * @description Solution 包含内容的类型
 * @keywords-cn solution类型, 包含类型, app, unit, workflow, agent
 * @keywords-en solution-include, solution-type, app, unit, workflow, agent
 * @keyword-en solution-include, solution-type, app, unit, workflow, agent
 */
export const SolutionIncludeEnum = z.enum([
  'app',
  'unit',
  'workflow',
  'agent',
  'view',
]);
export type SolutionInclude = z.infer<typeof SolutionIncludeEnum>;

/**
 * @title Solution 来源枚举
 * @description Solution 的来源类型
 * @keywords-cn solution来源, 自产开发, 市场插件
 * @keywords-en solution-source, self-developed, marketplace
 * @keyword-en solution-source, self-developed, marketplace
 */
export const SolutionSourceEnum = z.enum(['self_developed', 'marketplace']);
export type SolutionSource = z.infer<typeof SolutionSourceEnum>;

/**
 * @title Solution 信息接口
 * @description Solution 完整信息结构
 * @keywords-cn solution信息, solution结构, solution详情
 * @keywords-en solution-info, solution-structure, solution-detail
 * @keyword-en solution-info, solution-structure, solution-detail
 */
export interface SolutionInfo {
  /** Solution 稳定 ID */
  solutionId: string;
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
  /** 是否已完成 workspace/app 模板初始化 */
  isInitialized: boolean;
}

/**
 * @title Solution identity query schema
 * @description Identifies one solution by stable solutionId or name.
 * @keyword-en solution-identity, solution-detail
 * @keyword-cn Solution标识, 详情查询
 */
export const SolutionIdentitySchema = z
  .object({
    solutionId: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.solutionId || value.name), {
    message: 'solutionId or name is required',
  });

export type SolutionIdentity = z.infer<typeof SolutionIdentitySchema>;

/**
 * @title Batch solution identity query schema
 * @description Selects multiple solutions by ids or names; empty payload means all solutions.
 * @keyword-en batch-solution-identity, solution-list
 * @keyword-cn 批量Solution标识, Solution列表
 */
export const BatchSolutionIdentitySchema = z.object({
  solutionId: z.string().min(1).optional(),
  solutionIds: z.array(z.string().min(1)).optional(),
  name: z.string().min(1).optional(),
  names: z.array(z.string().min(1)).optional(),
});

export type BatchSolutionIdentity = z.infer<
  typeof BatchSolutionIdentitySchema
>;

/**
 * @title Runner solution app info
 * @description App metadata associated with a runner solution.
 * @keyword-en solution-app-list, app-association
 * @keyword-cn Solution应用列表, 应用关联
 */
export interface RunnerSolutionAppInfo {
  solutionId: string;
  solutionName: string;
  appId: string;
  name: string;
  version: string;
  description: string;
  status: string;
  isInitialized: boolean;
  location?: string;
}

/**
 * @title Runner solution unit info
 * @description Unit metadata discovered under a runner solution workspace directory.
 * @keyword-en solution-unit-list, unit-association
 * @keyword-cn Solution单元列表, 单元关联
 */
export interface RunnerSolutionUnitInfo {
  solutionId: string;
  solutionName: string;
  unitId: string;
  unitName: string;
  source: 'solution-workspace';
  sourcePath: string;
}

/**
 * @title Runner solution detail
 * @description Full solution detail including associated app and unit lists.
 * @keyword-en solution-detail, app-unit-detail
 * @keyword-cn Solution详情, 应用单元详情
 */
export interface RunnerSolutionDetail extends SolutionInfo {
  apps: RunnerSolutionAppInfo[];
  units: RunnerSolutionUnitInfo[];
}

/**
 * @title Solution 安装请求
 * @description 安装 Solution 的请求参数
 * @keywords-cn solution安装, 安装请求, 安装参数
 * @keywords-en solution-install, install-request, install-params
 * @keyword-en solution-install, install-request, install-params
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
 * @title Solution metadata upsert request
 * @description Creates or updates a Runner-local solution metadata record in the source solutions collection.
 * @keyword-en solution-upsert, solution-metadata
 * @keyword-cn Solution更新, Solution元数据
 */
export const UpsertSolutionMetadataSchema = z.object({
  solutionId: z.string().min(1).optional(),
  name: z.string().min(1),
  version: z.string().min(1).optional(),
  source: SolutionSourceEnum.optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  images: z.array(z.string()).optional(),
  includes: z.array(SolutionIncludeEnum).optional(),
  isInitialized: z.boolean().optional(),
});

export type UpsertSolutionMetadata = z.infer<
  typeof UpsertSolutionMetadataSchema
>;

/**
 * @title code-agent 目标确保请求
 * @description SaaS code-agent 通过 Runner hook 确保 Solution/App 元数据存在。
 * @keyword-en ensure-target, solution-create, app-create
 */
export const EnsureSolutionTargetSchema = z.object({
  runnerId: z.string().optional(),
  solutionName: z.string().min(1),
  solutionVersion: z.string().optional(),
  solutionSummary: z.string().optional(),
  solutionDescription: z.string().optional(),
  appName: z.string().optional(),
  appVersion: z.string().optional(),
  appDescription: z.string().optional(),
  sessionId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type EnsureSolutionTarget = z.infer<typeof EnsureSolutionTargetSchema>;

/**
 * @title Solution 搜索查询
 * @description 搜索 Solution 的查询参数
 * @keywords-cn solution搜索, 搜索查询, 查询参数
 * @keywords-en solution-search, search-query, query-params
 * @keyword-en solution-search, search-query, query-params
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
 * @keyword-en solution-list, list-query, pagination
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
