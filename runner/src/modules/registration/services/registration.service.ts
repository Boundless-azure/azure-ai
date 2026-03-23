import { io, type Socket } from 'socket.io-client';
import { getRunnerConfig, saveRunnerConfig } from '../../../config/store';
import type { FrpcConfig } from '../../frpc/types/frpc.types';

/**
 * @title Runner 注册服务
 * @description 负责使用 runnerId 与 runnerKey 连接 SaaS 并完成 socket.io 注册。
 * @keywords-cn Runner注册, Socket客户端, 状态同步
 * @keywords-en runner-registration, socket-client, status-sync
 */
export class RunnerRegistrationService {
  private socket?: Socket;
  private lastStatus: 'idle' | 'connected' | 'registered' | 'failed' = 'idle';
  private lastError: string | null = null;
  private frpcConfig: FrpcConfig | null = null;

  status() {
    return {
      state: this.lastStatus,
      error: this.lastError,
      connected: Boolean(this.socket?.connected),
    };
  }

  /**
   * @title 获取 FRPC 配置
   * @description 返回当前保存的 FRPC 配置。
   * @keywords-cn FRPC配置, 获取配置
   * @keywords-en frpc-config, get-config
   */
  getFrpcConfig(): FrpcConfig | null {
    return this.frpcConfig;
  }

  async testRunnerKey(input?: {
    saasSocketUrl?: string;
    runnerKey?: string;
    runnerId?: string;
  }): Promise<{ ok: boolean; message: string; runnerId?: string }> {
    const config = getRunnerConfig();
    const saasSocketUrl = input?.saasSocketUrl ?? config.saasSocketUrl;
    const runnerKey = input?.runnerKey ?? config.runnerKey;
    const runnerId = input?.runnerId ?? config.runnerId;
    if (!saasSocketUrl || !runnerKey) {
      return { ok: false, message: 'runner key or saas socket url is missing' };
    }
    const result = await this.connectAndRegister({
      saasSocketUrl,
      runnerKey,
      runnerId,
      persistRunnerId: true,
    });
    if (!result.ok) return result;
    return {
      ok: true,
      message: 'runner key is valid',
      runnerId: result.runnerId,
    };
  }

  async registerNow(): Promise<{ ok: boolean; message: string }> {
    const config = getRunnerConfig();
    if (!config.saasSocketUrl || !config.runnerKey) {
      this.lastStatus = 'failed';
      this.lastError = 'runner key or saas socket url is missing';
      return { ok: false, message: this.lastError };
    }
    const result = await this.connectAndRegister({
      saasSocketUrl: config.saasSocketUrl,
      runnerKey: config.runnerKey,
      runnerId: config.runnerId,
      persistRunnerId: true,
    });
    if (!result.ok) return { ok: false, message: result.message };
    return { ok: true, message: 'runner registered' };
  }

  private async connectAndRegister(input: {
    saasSocketUrl: string;
    runnerKey: string;
    runnerId?: string;
    persistRunnerId?: boolean;
  }): Promise<{ ok: boolean; message: string; runnerId?: string; admissionPort?: number; frpsHost?: string; frpsPort?: number }> {
    if (this.socket?.connected) {
      this.socket.disconnect();
    }
    this.lastStatus = 'idle';
    this.lastError = null;
    const socket = io(`${input.saasSocketUrl}/runner/ws`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      timeout: 5000,
    });
    this.socket = socket;
    return await new Promise((resolve) => {
      socket.on('connect', () => {
        this.lastStatus = 'connected';
        socket.emit(
          'runner/register',
          { runnerId: input.runnerId, key: input.runnerKey },
          (resp: { ok?: boolean; error?: string; runnerId?: string; admissionPort?: number; frpsHost?: string; frpsPort?: number }) => {
            if (resp?.ok) {
              this.lastStatus = 'registered';
              this.lastError = null;
              if (resp.runnerId && input.persistRunnerId) {
                saveRunnerConfig({ runnerId: resp.runnerId });
              }

              // 保存 FRPC 配置
              if (resp.admissionPort && resp.frpsHost) {
                this.frpcConfig = {
                  serverAddr: resp.frpsHost,
                  serverPort: resp.frpsPort || 7000,
                  authMethod: 'token',
                  token: input.runnerKey,
                  proxies: [],
                };
              }

              resolve({
                ok: true,
                message: 'runner registered',
                runnerId: resp.runnerId,
                admissionPort: resp.admissionPort,
                frpsHost: resp.frpsHost,
                frpsPort: resp.frpsPort,
              });
              return;
            }
            this.lastStatus = 'failed';
            this.lastError = resp?.error ?? 'runner register failed';
            resolve({ ok: false, message: this.lastError });
          },
        );
      });
      socket.on('connect_error', (error: Error) => {
        this.lastStatus = 'failed';
        this.lastError = error.message;
        resolve({ ok: false, message: error.message });
      });
    });
  }
}
