/**
 * @title Solution Types
 * @description Solution module type definitions
 * @keywords-cn Solution类型, Solution管理类型
 * @keywords-en solution-types, solution-management-types
 */

// Solution 来源
export type SolutionSource = 'self_developed' | 'marketplace';

// Solution 包含类型
export type SolutionInclude = 'app' | 'unit' | 'workflow' | 'agent';

// Solution 状态
export type SolutionStatus = 'active' | 'inactive';

// Solution 响应
export interface Solution {
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
  status: SolutionStatus;
  isPublished: boolean;
  isInstalled: boolean;
  source: SolutionSource;
  location: string | null;
  images: string[] | null;
  includes: SolutionInclude[] | null;
  createdAt: string;
  updatedAt: string;
}

// 创建 Solution 请求
export interface CreateSolutionRequest {
  runnerIds?: string[] | null;
  name: string;
  version: string;
  summary?: string | null;
  description?: string | null;
  iconUrl?: string | null;
  tags?: string[] | null;
  authorName?: string | null;
  markdownContent?: string | null;
  pluginDir?: string | null;
  isPublished?: boolean;
  source?: SolutionSource;
  location?: string | null;
  images?: string[] | null;
  includes?: SolutionInclude[] | null;
}

// 安装 Solution 请求
export interface InstallSolutionRequest {
  runnerIds: string[];
}

// 卸载 Solution 请求
export interface UninstallSolutionRequest {
  runnerIds: string[];
}

// Runner 响应
export interface RunnerInfo {
  id: string;
  alias: string;
  status: string;
}

// 更新 Solution 请求
export interface UpdateSolutionRequest {
  summary?: string | null;
  description?: string | null;
  iconUrl?: string | null;
  tags?: string[] | null;
  markdownContent?: string | null;
  status?: SolutionStatus;
  isPublished?: boolean;
  source?: SolutionSource;
  location?: string | null;
  images?: string[] | null;
  includes?: SolutionInclude[] | null;
}

// Solution 列表查询
export interface ListSolutionsQuery {
  page?: number;
  pageSize?: number;
  tag?: string;
  q?: string;
  isInstalled?: boolean;
  isPublished?: boolean;
  source?: SolutionSource;
  runnerId?: string;
}

// 分页响应
export interface PaginatedSolutionsResponse {
  items: Solution[];
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

// Solution 购买记录
export interface SolutionPurchase {
  id: string;
  userId: string;
  solutionId: string;
  solutionName: string;
  solutionVersion: string;
  runnerId: string | null;
  purchasedAt: string;
  createdAt: string;
}

// 购买 Solution 请求
export interface PurchaseSolutionRequest {
  solutionId: string;
  solutionName: string;
  solutionVersion: string;
}
