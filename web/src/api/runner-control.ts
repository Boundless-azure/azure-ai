/**
 * @title Runner Control API
 * @description Runner 控制面板接口封装，使用动态 baseURL（Runner 域名）访问。
 * @keywords-cn Runner控制面板API, Solution管理, 应用管理, FRPC管理
 * @keywords-en runner-control-api, solution-management, app-management, frpc-management
 */
import type { BaseResponse } from '../utils/types';
import { runnerTokenService } from '../modules/runner/services/runner-token.service';

/**
 * @title Runner 应用
 */
export interface RunnerControlApp {
  appId: string;
  name: string;
  appPort: number;
  description?: string;
  status: string;
}

/**
 * @title Runner 应用域名
 */
export interface RunnerControlAppDomain {
  id: string;
  domain: string;
  runnerId: string;
  tenantId: string;
  pathPattern: string;
  active: boolean;
  appId?: string;
}

/**
 * @title Runner Solution
 */
export interface RunnerControlSolution {
  id: string;
  name: string;
  version: string;
  description?: string;
  status: string;
}

/**
 * @title Runner 性能统计数据
 */
export interface RunnerControlStats {
  cpuUsage: number;
  memoryUsage: number;
  frpcRunning: boolean;
  solutions: number;
  domainBindings: number;
  apps: number;
}

/**
 * @title Runner Control API 客户端
 */
class RunnerControlApiClient {
  private getBaseUrl(domainOrUrl: string): string {
    // domainOrUrl 可能是完整 URL（已含协议）或纯域名
    if (
      domainOrUrl.startsWith('http://') ||
      domainOrUrl.startsWith('https://')
    ) {
      return domainOrUrl;
    }
    // 纯域名，添加当前协议
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    return `${protocol}://${domainOrUrl}`;
  }

  private async request<T>(
    method: string,
    domain: string,
    path: string,
    body?: unknown,
  ): Promise<BaseResponse<T>> {
    const baseUrl = this.getBaseUrl(domain);
    const fullUrl = `${baseUrl}${path}`;

    // 自动获取 token
    const runnerId = sessionStorage.getItem('runner_control_runner_id');
    const token = runnerId
      ? await runnerTokenService.getOrRefreshToken(runnerId)
      : null;

    const headers: Record<string, string> = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const response = await fetch(fullUrl, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const json = await response.json();
      return json as BaseResponse<T>;
    } catch (error) {
      console.error(
        `[RunnerControlApi] Request failed: ${method} ${fullUrl}`,
        error,
      );
      throw error;
    }
  }

  // ============================================================
  // Solution 接口
  // ============================================================

  /**
   * @title 获取 Solution 列表
   */
  async listSolutions(
    domain: string,
  ): Promise<BaseResponse<RunnerControlSolution[]>> {
    return this.request<RunnerControlSolution[]>(
      'GET',
      domain,
      `/runner-control/solutions`,
    );
  }

  /**
   * @title 获取单个 Solution
   */
  async getSolution(
    domain: string,
    id: string,
  ): Promise<BaseResponse<RunnerControlSolution>> {
    return this.request<RunnerControlSolution>(
      'GET',
      domain,
      `/runner-control/solutions/${id}`,
    );
  }

  /**
   * @title 创建 Solution
   */
  async createSolution(
    domain: string,
    data: { name: string; version: string },
  ): Promise<BaseResponse<RunnerControlSolution>> {
    return this.request<RunnerControlSolution>(
      'POST',
      domain,
      '/runner-control/solutions',
      data,
    );
  }

  /**
   * @title 更新 Solution
   */
  async updateSolution(
    domain: string,
    id: string,
    data: { name?: string; version?: string },
  ): Promise<BaseResponse<RunnerControlSolution>> {
    return this.request<RunnerControlSolution>(
      'PUT',
      domain,
      `/runner-control/solutions/${id}`,
      data,
    );
  }

  /**
   * @title 删除 Solution
   */
  async deleteSolution(
    domain: string,
    id: string,
  ): Promise<BaseResponse<{ ok: boolean }>> {
    return this.request<{ ok: boolean }>(
      'DELETE',
      domain,
      `/runner-control/solutions/${id}`,
    );
  }

  // ============================================================
  // 应用域名接口
  // ============================================================

  /**
   * @title 获取应用域名列表
   */
  async listAppDomains(
    domain: string,
  ): Promise<BaseResponse<RunnerControlAppDomain[]>> {
    return this.request<RunnerControlAppDomain[]>(
      'GET',
      domain,
      `/runner-control/app-domains`,
    );
  }

  /**
   * @title 创建应用域名
   */
  async createAppDomain(
    domain: string,
    data: { domain: string; pathPattern?: string; appId?: string },
  ): Promise<BaseResponse<RunnerControlAppDomain>> {
    return this.request<RunnerControlAppDomain>(
      'POST',
      domain,
      '/runner-control/app-domains',
      data,
    );
  }

  /**
   * @title 更新应用域名
   */
  async updateAppDomain(
    domain: string,
    domainValue: string,
    data: { pathPattern?: string; appId?: string },
  ): Promise<BaseResponse<RunnerControlAppDomain>> {
    return this.request<RunnerControlAppDomain>(
      'PUT',
      domain,
      `/runner-control/app-domains/${encodeURIComponent(domainValue)}`,
      data,
    );
  }

  /**
   * @title 删除应用域名
   */
  async deleteAppDomain(
    domain: string,
    domainValue: string,
  ): Promise<BaseResponse<{ ok: boolean }>> {
    return this.request<{ ok: boolean }>(
      'DELETE',
      domain,
      `/runner-control/app-domains/${encodeURIComponent(domainValue)}`,
    );
  }

  // ============================================================
  // 应用管理接口
  // ============================================================

  /**
   * @title 获取应用列表
   */
  async listApps(domain: string): Promise<BaseResponse<RunnerControlApp[]>> {
    return this.request<RunnerControlApp[]>(
      'GET',
      domain,
      `/runner-control/apps`,
    );
  }

  /**
   * @title 获取单个应用
   */
  async getApp(
    domain: string,
    id: string,
  ): Promise<BaseResponse<RunnerControlApp>> {
    return this.request<RunnerControlApp>(
      'GET',
      domain,
      `/runner-control/apps/${id}`,
    );
  }

  /**
   * @title 创建应用
   */
  async createApp(
    domain: string,
    data: { name: string; appPort: number; description?: string },
  ): Promise<BaseResponse<RunnerControlApp>> {
    return this.request<RunnerControlApp>(
      'POST',
      domain,
      '/runner-control/apps',
      data,
    );
  }

  /**
   * @title 更新应用
   */
  async updateApp(
    domain: string,
    id: string,
    data: {
      name?: string;
      appPort?: number;
      description?: string;
      status?: string;
    },
  ): Promise<BaseResponse<RunnerControlApp>> {
    return this.request<RunnerControlApp>(
      'PUT',
      domain,
      `/runner-control/apps/${id}`,
      data,
    );
  }

  /**
   * @title 删除应用
   */
  async deleteApp(
    domain: string,
    id: string,
  ): Promise<BaseResponse<{ ok: boolean }>> {
    return this.request<{ ok: boolean }>(
      'DELETE',
      domain,
      `/runner-control/apps/${id}`,
    );
  }

  // ============================================================
  // 性能统计接口
  // ============================================================

  /**
   * @title 获取性能统计
   */
  async getStats(domain: string): Promise<BaseResponse<RunnerControlStats>> {
    return this.request<RunnerControlStats>(
      'GET',
      domain,
      `/runner-control/stats`,
    );
  }

  // ============================================================
  // FRPC 接口
  // ============================================================

  /**
   * @title 获取 FRPC 状态
   */
  async getFrpcStatus(
    domain: string,
  ): Promise<BaseResponse<{ running: boolean }>> {
    return this.request<{ running: boolean }>(
      'GET',
      domain,
      `/runner-control/frpc/status`,
    );
  }

  /**
   * @title 启动 FRPC
   */
  async startFrpc(
    domain: string,
  ): Promise<BaseResponse<{ ok: boolean; message: string }>> {
    return this.request<{ ok: boolean; message: string }>(
      'POST',
      domain,
      `/runner-control/frpc/start`,
    );
  }

  /**
   * @title 停止 FRPC
   */
  async stopFrpc(
    domain: string,
  ): Promise<BaseResponse<{ ok: boolean; message: string }>> {
    return this.request<{ ok: boolean; message: string }>(
      'POST',
      domain,
      `/runner-control/frpc/stop`,
    );
  }

  /**
   * @title 重载 FRPC
   */
  async reloadFrpc(
    domain: string,
  ): Promise<BaseResponse<{ ok: boolean; message: string }>> {
    return this.request<{ ok: boolean; message: string }>(
      'POST',
      domain,
      `/runner-control/frpc/reload`,
    );
  }
}

// Singleton instance
export const runnerControlApi = new RunnerControlApiClient();
