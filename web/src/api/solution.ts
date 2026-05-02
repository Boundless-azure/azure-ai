/**
 * @title Solution API
 * @description Solution module API calls
 * @keywords-cn SolutionAPI, Solution管理API
 * @keywords-en solution-api, solution-management-api
 */
import { http } from '../utils/http';
import type {
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
} from '../modules/solution/types/solution.types';

interface BaseResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

// 列出我的解决方案
export async function listSolutions(query: ListSolutionsQuery): Promise<PaginatedSolutionsResponse> {
  const res = await http.get<BaseResponse<PaginatedSolutionsResponse>>('/solutions', query);
  return res.data.data;
}

// 列出市场解决方案
export async function listMarketplaceSolutions(query: ListSolutionsQuery): Promise<PaginatedSolutionsResponse> {
  const res = await http.get<BaseResponse<PaginatedSolutionsResponse>>('/solutions/marketplace/list', query);
  return res.data.data;
}

// 获取解决方案详情
export async function getSolution(id: string): Promise<Solution> {
  const res = await http.get<BaseResponse<Solution>>(`/solutions/${id}`);
  return res.data.data;
}

// 创建解决方案
export async function createSolution(data: CreateSolutionRequest): Promise<Solution> {
  const res = await http.post<BaseResponse<Solution>>('/solutions', data);
  return res.data.data;
}

// 更新解决方案
export async function updateSolution(id: string, data: UpdateSolutionRequest): Promise<Solution> {
  const res = await http.put<BaseResponse<Solution>>(`/solutions/${id}`, data);
  return res.data.data;
}

// 删除解决方案
export async function deleteSolution(id: string): Promise<void> {
  await http.delete(`/solutions/${id}`);
}

// 安装解决方案
export async function installSolution(id: string, data: InstallSolutionRequest): Promise<Solution> {
  const res = await http.post<BaseResponse<Solution>>(`/solutions/${id}/install`, data);
  return res.data.data;
}

// 卸载解决方案 :: 返回 { ok, failed[] }
//                  - ok=true 表示全部目标 Runner 卸载成功
//                  - failed 列出软错的 runnerId, 调用方可据此提示重试
export async function uninstallSolution(
  id: string,
  data: UninstallSolutionRequest,
): Promise<{ ok: boolean; failed: string[] }> {
  const res = await http.delete<BaseResponse<{ ok: boolean; failed: string[] }>>(
    `/solutions/${id}/install`,
    data,
  );
  return res.data.data;
}

// 获取购买记录
export async function getPurchases(): Promise<SolutionPurchase[]> {
  const res = await http.get<BaseResponse<SolutionPurchase[]>>('/solutions/purchases/list');
  return res.data.data;
}

// 购买解决方案
export async function purchaseSolution(data: PurchaseSolutionRequest): Promise<SolutionPurchase> {
  const res = await http.post<BaseResponse<SolutionPurchase>>('/solutions/purchase', data);
  return res.data.data;
}

// 获取所有标签
export async function getTags(): Promise<TagResponse[]> {
  const res = await http.get<BaseResponse<TagResponse[]>>('/solutions/tags/list');
  return res.data.data;
}

// 获取所有 Runner
export async function getRunners(): Promise<RunnerInfo[]> {
  const res = await http.get<BaseResponse<RunnerInfo[]>>('/solutions/runners');
  return res.data.data;
}
