import { z } from 'zod';
import {
  PluginStatus,
  SolutionSource,
  SolutionInclude,
} from '../enums/solution.enums';

// 创建 Solution 请求
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

// 更新 Solution 请求
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

// Solution 列表查询
export const ListSolutionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  tag: z.string().optional(),
  q: z.string().optional(),
  isInstalled: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  source: z.nativeEnum(SolutionSource).optional(),
  runnerId: z.string().optional(),
});

export type ListSolutionsQuery = z.infer<typeof ListSolutionsQuerySchema>;

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
  source: SolutionSource;
  location: string | null;
  images: string[] | null;
  includes: SolutionInclude[] | null;
  createdAt: Date;
  updatedAt: Date;
}

// 分页响应
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
