/**
 * @title Runner API
 * @description Runner 管理接口与 Runner 面板代理接口封装。
 * @keywords-cn RunnerAPI, 增删改查, 域名管理, FRP管理
 * @keywords-en runner-api, crud, domain-management, frp-management
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

/**
 * @title Runner 管理 API
 * @description 提供 Runner 的增删改查接口。
 * @keywords-cn Runner管理, 增删改查
 * @keywords-en runner-crud, list, create, update, delete
 */
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

// ============================================================
// Runner 面板代理 API（按 runnerId 分组）
// ============================================================

/**
 * @title Runner 面板统计接口
 * @keywords-cn 性能统计, CPU, 内存
 * @keywords-en performance-stats, cpu, memory
 */
export interface RunnerStats {
  cpuUsage: number;
  memoryUsage: number;
  frpcRunning: boolean;
  solutions: number;
  domainBindings: number;
  apps: number;
  runners: number;
}

/**
 * @title Runner 域名绑定接口
 * @keywords-cn 域名绑定, 域名管理
 * @keywords-en domain-binding, domain-management
 */
export interface RunnerDomain {
  id: string;
  domain: string;
  runnerId: string;
  tenantId: string;
  pathPattern: string;
  active: boolean;
}

/**
 * @title Runner 应用接口
 * @keywords-cn Runner应用, 应用管理
 * @keywords-en runner-app, app-management
 */
export interface RunnerApp {
  appId: string;
  name: string;
  appPort: number;
  description?: string;
  status: string;
}

/**
 * @title Runner Solution 接口
 * @keywords-cn RunnerSolution, 方案管理
 * @keywords-en runner-solution, solution-management
 */
export interface RunnerSolution {
  id: string;
  name: string;
  version: string;
  appCount: number;
  installed: boolean;
}

/**
 * @title Runner 面板 API
 * @description 提供 Runner 控制面板所需的域名、应用、Solution、统计、FRP 管理接口。
 * @keywords-cn Runner面板API, 域名, 应用, Solution, FRP
 * @keywords-en runner-panel-api, domain, app, solution, frp
 */
export const runnerPanelApi = {
  /**
   * @title 获取 Runner 性能统计
   * @description 返回 CPU、内存、FRP 状态与核心数量统计。
   * @param runnerId Runner ID
   */
  getStats: (runnerId: string) =>
    http.get<RunnerStats>(`/runner/${runnerId}/stats`),

  /**
   * @title 获取域名列表
   * @description 返回 Runner 的所有域名绑定记录。
   * @param runnerId Runner ID
   */
  listDomains: (runnerId: string) =>
    http.get<RunnerDomain[]>(`/runner/${runnerId}/domains`),

  /**
   * @title 创建域名绑定
   * @param runnerId Runner ID
   * @param domain 域名
   * @param pathPattern 路径规则
   */
  createDomain: (runnerId: string, domain: string, pathPattern = '.*') =>
    http.post<RunnerDomain>(`/runner/${runnerId}/domains`, { domain, pathPattern }),

  /**
   * @title 删除域名绑定
   * @param runnerId Runner ID
   * @param domainId 域名绑定 ID
   */
  deleteDomain: (runnerId: string, domainId: string) =>
    http.delete<{ ok: boolean }>(`/runner/${runnerId}/domains/${domainId}`),

  /**
   * @title 获取应用列表
   * @param runnerId Runner ID
   */
  listApps: (runnerId: string) =>
    http.get<RunnerApp[]>(`/runner/${runnerId}/apps`),

  /**
   * @title 获取 Solution 列表
   * @param runnerId Runner ID
   */
  listSolutions: (runnerId: string) =>
    http.get<RunnerSolution[]>(`/runner/${runnerId}/solutions`),

  /**
   * @title 获取 FRP 状态
   * @param runnerId Runner ID
   */
  getFrpStatus: (runnerId: string) =>
    http.get<{ running: boolean }>(`/runner/${runnerId}/frp/status`),

  /**
   * @title 启动 FRP
   * @param runnerId Runner ID
   */
  startFrp: (runnerId: string) =>
    http.post<{ ok: boolean; message: string }>(`/runner/${runnerId}/frp/start`, {}),

  /**
   * @title 停止 FRP
   * @param runnerId Runner ID
   */
  stopFrp: (runnerId: string) =>
    http.post<{ ok: boolean; message: string }>(`/runner/${runnerId}/frp/stop`, {}),

  /**
   * @title 重载 FRP
   * @param runnerId Runner ID
   */
  reloadFrp: (runnerId: string) =>
    http.post<{ ok: boolean; message: string }>(`/runner/${runnerId}/frp/reload`, {}),

  /**
   * @title 检查免费域名是否已领取
   * @param runnerId Runner ID
   */
  checkFreeDomainClaimed: (runnerId: string) =>
    http.get<{ exists: boolean }>(`/reward-records/exists`, {
      params: { rewardType: 'domain', relatedId: runnerId },
    }),

  /**
   * @title 领取免费域名
   * @param runnerId Runner ID
   */
  claimFreeDomain: (runnerId: string) =>
    http.post<RunnerDomain>(`/runner/${runnerId}/claim-free-domain`, {}),
};

// Runner FRPC API（遗留兼容，建议使用 runnerPanelApi）
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
