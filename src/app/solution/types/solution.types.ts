import { z } from 'zod';
import {
  PluginStatus,
  SolutionSource,
  SolutionInclude,
} from '../enums/solution.enums';

/**
 * @title Create solution schema
 * @description Validates create Solution requests.
 * @keyword-en create-solution
 * @keyword-cn Solution创建
 */
export const CreateSolutionSchema = z.object({
  runnerIds: z.array(z.string()).optional().nullable(),
  name: z.string().min(1).max(255),
  version: z.string().min(1).max(64),
  summary: z.string().max(500).optional().nullable(),
  description: z.string().optional().nullable(),
  iconUrl: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  authorName: z.string().max(128).optional().nullable(),
  markdownContent: z.string().optional().nullable(),
  pluginDir: z.string().optional().nullable(),
  isPublished: z.boolean().optional().default(false),
  source: z
    .nativeEnum(SolutionSource)
    .optional()
    .default(SolutionSource.SELF_DEVELOPED),
  location: z.string().optional().nullable(),
  images: z.array(z.string()).optional().nullable(),
  includes: z.array(z.nativeEnum(SolutionInclude)).optional().nullable(),
});

export type CreateSolutionRequest = z.infer<typeof CreateSolutionSchema>;

/**
 * @title Update solution schema
 * @description Validates update Solution requests.
 * @keyword-en update-solution
 * @keyword-cn Solution更新
 */
export const UpdateSolutionSchema = z.object({
  summary: z.string().max(500).optional().nullable(),
  description: z.string().optional().nullable(),
  iconUrl: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  markdownContent: z.string().optional().nullable(),
  status: z.nativeEnum(PluginStatus).optional(),
  isPublished: z.boolean().optional(),
  source: z.nativeEnum(SolutionSource).optional(),
  location: z.string().optional().nullable(),
  images: z.array(z.string()).optional().nullable(),
  includes: z.array(z.nativeEnum(SolutionInclude)).optional().nullable(),
});

export type UpdateSolutionRequest = z.infer<typeof UpdateSolutionSchema>;

/**
 * @title List solutions query schema
 * @description Validates Solution list filters and pagination.
 * @keyword-en list-solutions
 * @keyword-cn Solution列表
 */
export const ListSolutionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  tag: z.string().optional(),
  q: z.string().optional(),
  isInstalled: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  source: z.nativeEnum(SolutionSource).optional(),
  runnerId: z.string().optional(),
  runnerIds: z.array(z.string()).optional(),
});

export type ListSolutionsQuery = z.infer<typeof ListSolutionsQuerySchema>;

/**
 * @title Runner solution search schema
 * @description Searches runner-owned solutions across one or more runner ids.
 * @keyword-en runner-solution-search, batch-runner
 * @keyword-cn Runner方案搜索, 批量Runner
 */
export const SearchRunnerSolutionsSchema = z.object({
  runnerId: z.string().optional(),
  runnerIds: z.array(z.string()).optional(),
  q: z.string().optional(),
  source: z.nativeEnum(SolutionSource).optional(),
  include: z.nativeEnum(SolutionInclude).optional(),
});

export type SearchRunnerSolutionsRequest = z.infer<
  typeof SearchRunnerSolutionsSchema
>;

/**
 * @title Batch solution ids schema
 * @description Accepts one or more solution ids for batch detail lookup.
 * @keyword-en batch-solution-detail, solution-id-list
 * @keyword-cn 批量Solution详情, Solution标识列表
 */
export const BatchSolutionIdsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export type BatchSolutionIdsRequest = z.infer<typeof BatchSolutionIdsSchema>;

/**
 * @title Batch solution association schema
 * @description Accepts one or more solution ids for associated app or unit listing.
 * @keyword-en batch-solution-association, solution-id-list
 * @keyword-cn 批量Solution关联, Solution标识列表
 */
export const BatchSolutionAssociationsSchema = z.object({
  solutionIds: z.array(z.string().min(1)).min(1),
});

export type BatchSolutionAssociationsRequest = z.infer<
  typeof BatchSolutionAssociationsSchema
>;

export interface SolutionSearchItem {
  id: string;
  runnerId: string;
  solutionId: string;
  name: string;
  version: string;
  summary: string | null;
}

export interface SolutionAppListItem {
  id: string;
  runnerId: string;
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

export interface SolutionUnitListItem {
  id: string;
  runnerId: string;
  solutionId: string;
  solutionName: string;
  unitId: string;
  unitName: string;
  source: string;
  sourcePath: string;
}

// Solution 响应
export interface SolutionResponse {
  id: string;
  runnerIds: string[];
  tenantId: string | null;
  name: string;
  version: string;
  summary: string | null;
  description: string | null;
  iconUrl: string | null;
  tags: string[] | null;
  authorName: string | null;
  authorId: string | null;
  markdownContent: string | null;
  pluginDir: string | null;
  installCount: number;
  rating: number;
  status: PluginStatus;
  isPublished: boolean;
  isInstalled: boolean;
  isInitialized: boolean;
  source: SolutionSource;
  location: string | null;
  images: string[] | null;
  includes: SolutionInclude[] | null;
  createdAt: Date;
  updatedAt: Date;
}

// 分页响应
export interface SolutionDetailResponse extends SolutionResponse {
  runnerId: string;
  solutionId: string;
  apps: SolutionAppListItem[];
  units: SolutionUnitListItem[];
}

export interface PaginatedSolutionsResponse {
  items: SolutionResponse[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Tag 响应
export interface TagResponse {
  tag: string;
  count: number;
}

// 安装 Solution 请求
export interface InstallSolutionRequest {
  runnerIds: string[];
}

// 卸载 Solution 请求
export interface UninstallSolutionRequest {
  runnerIds: string[];
}

// 购买记录响应
export interface SolutionPurchaseResponse {
  id: string;
  userId: string;
  solutionId: string;
  solutionName: string;
  solutionVersion: string;
  runnerId: string | null;
  purchasedAt: Date;
  createdAt: Date;
}

// 购买 Solution 请求
export interface PurchaseSolutionRequest {
  solutionId: string;
  solutionName: string;
  solutionVersion: string;
}
