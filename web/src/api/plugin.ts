/**
 * @title Plugin API
 * @description Plugin module API calls
 * @keywords-cn 插件API, 插件管理API
 * @keywords-en plugin-api, plugin-management-api
 */
import { http } from '../utils/http';
import type {
  Plugin,
  CreatePluginRequest,
  UpdatePluginRequest,
  ListPluginsQuery,
  PaginatedPluginsResponse,
  TagResponse,
  InstallPluginRequest,
  UninstallPluginRequest,
  RunnerInfo,
} from '../modules/plugin/types/plugin.types';

interface BaseResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

// 列出我的插件
export async function listPlugins(query: ListPluginsQuery): Promise<PaginatedPluginsResponse> {
  const res = await http.get<BaseResponse<PaginatedPluginsResponse>>('/plugins', query);
  return res.data.data;
}

// 列出市场插件
export async function listMarketplacePlugins(query: ListPluginsQuery): Promise<PaginatedPluginsResponse> {
  const res = await http.get<BaseResponse<PaginatedPluginsResponse>>('/plugins/marketplace/list', query);
  return res.data.data;
}

// 获取插件详情
export async function getPlugin(id: string): Promise<Plugin> {
  const res = await http.get<BaseResponse<Plugin>>(`/plugins/${id}`);
  return res.data.data;
}

// 创建插件
export async function createPlugin(data: CreatePluginRequest): Promise<Plugin> {
  const res = await http.post<BaseResponse<Plugin>>('/plugins', data);
  return res.data.data;
}

// 更新插件
export async function updatePlugin(id: string, data: UpdatePluginRequest): Promise<Plugin> {
  const res = await http.put<BaseResponse<Plugin>>(`/plugins/${id}`, data);
  return res.data.data;
}

// 删除插件
export async function deletePlugin(id: string): Promise<void> {
  await http.delete(`/plugins/${id}`);
}

// 安装插件
export async function installPlugin(id: string, data: InstallPluginRequest): Promise<Plugin> {
  const res = await http.post<BaseResponse<Plugin>>(`/plugins/${id}/install`, data);
  return res.data.data;
}

// 卸载插件
export async function uninstallPlugin(id: string, data: UninstallPluginRequest): Promise<Plugin> {
  const res = await http.delete<BaseResponse<Plugin>>(`/plugins/${id}/install`, data);
  return res.data.data;
}

// 获取所有标签
export async function getTags(): Promise<TagResponse[]> {
  const res = await http.get<BaseResponse<TagResponse[]>>('/plugins/tags/list');
  return res.data.data;
}

// 获取所有 Runner
export async function getRunners(): Promise<RunnerInfo[]> {
  const res = await http.get<BaseResponse<RunnerInfo[]>>('/plugins/runners');
  return res.data.data;
}
