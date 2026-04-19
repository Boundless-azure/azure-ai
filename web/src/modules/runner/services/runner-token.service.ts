/**
 * @title Runner Token 数据结构
 */
export interface RunnerTokenData {
  token: string;
  expiresAt: number;
}

/**
 * @title Runner Token 服务
 * @description 管理 runner-control 接口的临时凭证，包括请求、存储和自动刷新。
 * @keywords-cn Runner临时凭证, Token管理, 自动刷新
 * @keywords-en runner-token, token-management, auto-refresh
 */

import { http } from '../../../utils/http';

const TOKEN_KEY = 'runner_control_token';
const TOKEN_EXPIRES_KEY = 'runner_control_token_expires';

class RunnerTokenService {
  private currentToken: string | null = null;
  private expiresAt: number = 0;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * @title 从 localStorage 加载 token
   */
  private loadFromStorage(): void {
    this.currentToken = localStorage.getItem(TOKEN_KEY);
    const expiresStr = localStorage.getItem(TOKEN_EXPIRES_KEY);
    this.expiresAt = expiresStr ? parseInt(expiresStr, 10) : 0;
  }

  /**
   * @title 保存 token 到 localStorage
   */
  private saveToStorage(token: string, expiresAt: number): void {
    this.currentToken = token;
    this.expiresAt = expiresAt;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_EXPIRES_KEY, String(expiresAt));
  }

  /**
   * @title 判断 token 是否有效
   */
  isValid(): boolean {
    if (!this.currentToken || !this.expiresAt) {
      return false;
    }
    // 提前 5 分钟判断是否需要刷新
    return Date.now() < this.expiresAt - 5 * 60 * 1000;
  }

  /**
   * @title 获取当前 token
   */
  getToken(): string | null {
    if (!this.isValid()) {
      this.clearToken();
      return null;
    }
    return this.currentToken;
  }

  /**
   * @title 清除 token
   */
  clearToken(): void {
    this.currentToken = null;
    this.expiresAt = 0;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRES_KEY);
  }

  /**
   * @title 请求新 token
   * @description 通过 SaaS Socket.IO 向 Runner 请求临时凭证。
   * @param runnerId Runner ID
   */
  async requestToken(runnerId: string): Promise<boolean> {
    try {
      const data = await http.post<{
        ok: boolean;
        token?: string;
        expiresAt?: number;
      }>(`/runner/${runnerId}/request-token`);
      if (data.data?.ok && data.data.token) {
        this.saveToStorage(data.data.token, data.data.expiresAt);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[RunnerToken] Failed to request token:', err);
      return false;
    }
  }

  /**
   * @title 获取或刷新 token
   * @description 如果 token 无效则请求新 token。
   */
  async getOrRefreshToken(runnerId: string): Promise<string | null> {
    if (this.isValid()) {
      return this.currentToken;
    }
    const ok = await this.requestToken(runnerId);
    return ok ? this.currentToken : null;
  }
}

// Singleton instance
export const runnerTokenService = new RunnerTokenService();
