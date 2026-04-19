import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { randomBytes } from 'node:crypto';

/**
 * @title Runner Token 数据结构
 */
export interface RunnerTokenData {
  token: string;
  expiresAt: number;
  runnerId: string;
}

/**
 * @title Runner Token 服务
 * @description 管理 runner-control 接口的临时凭证生命周期。
 *              Gateway 和 Controller 都使用此服务来请求和验证 token。
 * @keywords-cn Runner临时凭证, Token管理, 鉴权
 * @keywords-en runner-token, auth, credential
 */
@Injectable()
export class RunnerTokenService {
  private readonly runnerSocketMap = new Map<string, string>();
  private tokenData: RunnerTokenData | null = null;

  /**
   * @title 注册 Runner Socket
   * @description 当 Runner 注册时，保存 runnerId -> socketId 的映射。
   */
  registerRunner(runnerId: string, socketId: string): void {
    this.runnerSocketMap.set(runnerId, socketId);
  }

  /**
   * @title 注销 Runner
   * @description 当 Runner 断开时，清除映射并清除 token。
   */
  unregisterRunner(runnerId: string): void {
    this.runnerSocketMap.delete(runnerId);
    if (this.tokenData?.runnerId === runnerId) {
      this.tokenData = null;
    }
  }

  /**
   * @title 请求 Token
   * @description 通过 Socket 向 Runner 发送 token 请求，等待回调返回 token 数据。
   * @param io Socket.IO Server 实例
   * @param runnerId Runner ID
   * @returns Token 数据
   */
  async requestToken(
    io: Server,
    runnerId: string,
  ): Promise<RunnerTokenData | null> {
    const resp = await this.requestFromRunner<{
      token: string;
      expiresAt: number;
    }>(io, runnerId, 'runner/request-token', { runnerId });
    if (!resp?.token) return null;
    const tokenData: RunnerTokenData = {
      token: resp.token,
      expiresAt: resp.expiresAt,
      runnerId,
    };
    this.tokenData = tokenData;
    return tokenData;
  }

  /**
   * @title 验证 Token
   * @description 验证 token 是否有效（存在、未过期）。
   */
  validateToken(token: string): boolean {
    if (!this.tokenData || this.tokenData.token !== token) {
      return false;
    }
    if (Date.now() > this.tokenData.expiresAt) {
      this.tokenData = null;
      return false;
    }
    return true;
  }

  /**
   * @title 获取当前 Token
   */
  getCurrentToken(): RunnerTokenData | null {
    if (!this.tokenData) return null;
    if (Date.now() > this.tokenData.expiresAt) {
      this.tokenData = null;
      return null;
    }
    return this.tokenData;
  }

  /**
   * @title 向 Runner 发送指令
   * @description 通过 Socket 向已在线的 Runner 推送一个事件。
   * @param io Socket.IO Server 实例
   * @param runnerId Runner ID
   * @param event 事件名
   * @param payload 事件载荷
   * @returns 是否发送成功
   * @keywords-cn 发送指令, 事件推送, Runner通信
   * @keywords-en send-to-runner, event-push, runner-command
   */
  sendToRunner(
    io: Server,
    runnerId: string,
    event: string,
    payload?: unknown,
  ): boolean {
    const socket = this.getRunnerSocket(io, runnerId);
    if (!socket) return false;
    if (payload !== undefined) {
      socket.emit(event, payload);
    } else {
      socket.emit(event);
    }
    return true;
  }

  /**
   * @title 向 Runner 发送带回调的请求
   * @description 通过 Socket 干道向 Runner 发送事件并等待 ACK 回调，5s 超时返回 null。
   * @param io Socket.IO Server 实例
   * @param runnerId Runner ID
   * @param event 事件名
   * @param payload 事件载荷（可选）
   * @returns Runner 回调结果
   * @keywords-cn 带回调请求, ACK, 超时处理
   * @keywords-en request-from-runner, ack, timeout
   */
  requestFromRunner<T>(
    io: Server,
    runnerId: string,
    event: string,
    payload?: unknown,
  ): Promise<T | null> {
    const socket = this.getRunnerSocket(io, runnerId);
    if (!socket) return Promise.resolve(null);

    return new Promise<T | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 5000);
      const cb = (resp: T) => {
        clearTimeout(timer);
        resolve(resp ?? null);
      };
      if (payload !== undefined) {
        socket.emit(event, payload, cb);
      } else {
        socket.emit(event, cb);
      }
    });
  }

  /**
   * @title 获取 Runner Socket 实例
   * @description 内部辅助方法，按 runnerId 查找已注册的 Socket。
   * @keywords-en get-runner-socket, internal
   */
  private getRunnerSocket(io: Server, runnerId: string): Socket | null {
    const socketId = this.runnerSocketMap.get(runnerId);
    if (!socketId) return null;
    // @ts-expect-error - sockets 是 socket.io 内部属性
    const socket: Socket = io?.sockets?.get(socketId);
    return socket ?? null;
  }
}
