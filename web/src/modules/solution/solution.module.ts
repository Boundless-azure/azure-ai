/**
 * @title Solution Module
 * @description Solution module exports
 * @keywords-cn Solution模块, Solution管理
 * @keywords-en solution-module, solution-management
 */
export { useSolutions } from './hooks/useSolutions';
export type {
  Solution,
  CreateSolutionRequest,
  UpdateSolutionRequest,
  ListSolutionsQuery,
  PaginatedSolutionsResponse,
  TagResponse,
  InstallSolutionRequest,
  UninstallSolutionRequest,
  RunnerInfo,
  SolutionPurchase,
  PurchaseSolutionRequest,
  SolutionSource,
  SolutionInclude,
  SolutionStatus,
} from './types/solution.types';
