import { randomBytes } from 'node:crypto';

/**
 * @title Runner 临时凭证服务（单例）
 * @description 生成和验证 runner-control 接口的临时访问凭证。
 * @keywords-cn 临时凭证, Token, 鉴权
 * @keywords-en temp-token, auth, credential
 */

/**
 * @title Token 数据结构
 */
interface TokenData {
  token: string;
  expiresAt: number;
  runnerId: string;
}

/**
 * @title RunnerTokenService
 * @description 管理临时凭证的生命周期，有效期 1 小时。
 */
export class RunnerTokenService {
  private static _instance: RunnerTokenService | null = null;
  private token: TokenData | null = null;

  /**
   * @title 获取单例实例
   */
  static getInstance(): RunnerTokenService {
    if (!RunnerTokenService._instance) {
      RunnerTokenService._instance = new RunnerTokenService();
    }
    return RunnerTokenService._instance;
  }

  private constructor() {}

  /**
   * @title 生成新 Token
   * @description 生成 32 字节随机 token，有效期 1 小时。
   * @param runnerId Runner ID
   * @returns Token 数据
   */
  generateToken(runnerId: string): TokenData {
    const token = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 小时
    this.token = { token, expiresAt, runnerId };
    return this.token;
  }

  /**
   * @title 验证 Token
   * @description 检查 token 是否有效（存在、未过期）。
   * @param token 要验证的 token
   * @returns 是否有效
   */
  validateToken(token: string): boolean {
    if (!this.token || this.token.token !== token) {
      return false;
    }
    if (Date.now() > this.token.expiresAt) {
      this.token = null;
      return false;
    }
    return true;
  }

  /**
   * @title 获取当前 Token
   * @description 返回当前有效的 token（未过期）。
   */
  getCurrentToken(): TokenData | null {
    if (!this.token) return null;
    if (Date.now() > this.token.expiresAt) {
      this.token = null;
      return null;
    }
    return this.token;
  }
}
