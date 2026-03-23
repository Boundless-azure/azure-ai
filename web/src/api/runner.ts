/**
 * @title Runner API
 * @description Runner 管理接口封装。
 * @keywords-cn RunnerAPI, 增删改查, 密钥返回
 * @keywords-en runner-api, crud, key-response
 */
import { http } from '../utils/http';
import type {
  CreateRunnerRequest,
  CreateRunnerResult,
  RunnerItem,
  UpdateRunnerRequest,
} from '../modules/runner/types/runner.types';
import {
  CreateRunnerRequestSchema,
  UpdateRunnerRequestSchema,
} from '../modules/runner/types/runner.types';

export const runnerApi = {
  list: (params?: { q?: string; status?: string; principalId?: string }) =>
    http.get<RunnerItem[]>('/runner', params),
  get: (id: string) => http.get<RunnerItem>(`/runner/${id}`),
  create: (data: CreateRunnerRequest) => {
    const parsed = CreateRunnerRequestSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid create runner payload');
    return http.post<CreateRunnerResult>('/runner', parsed.data);
  },
  update: (id: string, data: UpdateRunnerRequest) => {
    const parsed = UpdateRunnerRequestSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid update runner payload');
    return http.put<RunnerItem>(`/runner/${id}`, parsed.data);
  },
  delete: (id: string) => http.delete<{ ok: boolean }>(`/runner/${id}`),
};

// Runner FRPC API (供 Runner 控制面板使用)
export const runnerFrpcApi = {
  status: () => http.get<{ code: number; data: { running: boolean } }>('/frpc/status'),
  start: (config: {
    serverAddr: string;
    serverPort: number;
    authMethod: string;
    token: string;
    proxies: Array<{
      name: string;
      type: string;
      localIp: string;
      localPort: number;
      customDomains: string[];
    }>;
  }) => http.post<{ code: number; message: string }>('/frpc/start', config),
  stop: () => http.post<{ code: number; message: string }>('/frpc/stop'),
  reload: () => http.post<{ code: number; message: string }>('/frpc/reload'),
};
