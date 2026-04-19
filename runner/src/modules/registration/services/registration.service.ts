import { io, type Socket } from 'socket.io-client';
import { getRunnerConfig, saveRunnerConfig } from '../../../config/store';
import { FrpcService } from '../../frpc/services/frpc.service';
import type { FrpcConfig } from '../../frpc/types/frpc.types';
import { RunnerTokenService } from '../../runner-control/services/token.service';
import { RunnerStatsService } from '../../runner-control/services/stats.service';

/**
 * @title Runner 注册服务
 * @description 负责使用 runnerId 与 runnerKey 连接 SaaS 并完成 socket.io 注册；
 *              注册成功后自动根据 frps 分配信息启动 frpc（含 metadata.runner_key）。
 * @keywords-cn Runner注册, Socket客户端, 状态同步, 自动启frpc
 * @keywords-en runner-registration, socket-client, status-sync, auto-start-frpc
 */
export class RunnerRegistrationService {
  private socket?: Socket;
  private lastStatus: 'idle' | 'connected' | 'registered' | 'failed' = 'idle';
  private lastError: string | null = null;
  private frpcConfig: FrpcConfig | null = null;
  private readonly frpcService: FrpcService;
  private readonly tokenService: RunnerTokenService;

  constructor() {
    const config = getRunnerConfig();
    this.frpcService = FrpcService.getInstance(config.frpcBinPath);
    this.tokenService = RunnerTokenService.getInstance();
  }

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
  }): Promise<{ ok: boolean; message: string; runnerId?: string }> {
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
          async (resp: {
            ok?: boolean;
            error?: string;
            runnerId?: string;
            admissionPort?: number;
            frpsHost?: string;
            frpsPort?: number;
            frpsToken?: string;
          }) => {
            if (!resp?.ok) {
              this.lastStatus = 'failed';
              this.lastError = resp?.error ?? 'runner register failed';
              resolve({ ok: false, message: this.lastError! });
              return;
            }

            this.lastStatus = 'registered';
            this.lastError = null;
            if (resp.runnerId && input.persistRunnerId) {
              saveRunnerConfig({ runnerId: resp.runnerId });
            }

            // 构建并保存 frpc 配置，随即自动启动 frpc
            console.log(`[Registration][TRACE] Socket resp: ok=${resp.ok} admissionPort=${resp.admissionPort} frpsHost=${resp.frpsHost} frpsPort=${resp.frpsPort} hasToken=${!!resp.frpsToken}`);
            if (resp.admissionPort && resp.frpsHost && resp.frpsToken) {
              const cfg: FrpcConfig = {
                serverAddr: resp.frpsHost,
                serverPort: resp.frpsPort ?? 7000,
                serverToken: resp.frpsToken,
                runnerKey: input.runnerKey,
                admissionPort: resp.admissionPort,
                localPort: getRunnerConfig().frpcLocalPort,
                adminPort: 7400,
              };
              this.frpcConfig = cfg;
              try {
                await this.frpcService.generateConfig(cfg);
                await this.frpcService.start();
                console.log('[Registration] frpc started, tunnel port:', resp.admissionPort);
              } catch (err) {
                console.error('[Registration] frpc start failed:', err);
              }
            }

            resolve({ ok: true, message: 'runner registered', runnerId: resp.runnerId });
          },
        );

        // 监听 SaaS 请求临时凭证
        socket.on('runner/request-token', (payload: { runnerId: string }, callback: (data: { token: string; expiresAt: number }) => void) => {
          const config = getRunnerConfig();
          if (payload.runnerId !== config.runnerId) {
            callback({ token: '', expiresAt: 0 });
            return;
          }
          const tokenData = this.tokenService.generateToken(payload.runnerId);
          console.log(`[Registration] Token generated for runner: ${payload.runnerId}`);
          callback({ token: tokenData.token, expiresAt: tokenData.expiresAt });
        });

        // 监听 SaaS 下发 FRP 启动指令
        socket.on('runner/frp:start', async () => {
          if (!this.frpcConfig) {
            console.warn('[Registration] frp:start received but no frpcConfig available');
            return;
          }
          try {
            await this.frpcService.generateConfig(this.frpcConfig);
            await this.frpcService.start();
            console.log('[Registration] frpc restarted via SaaS command');
          } catch (err) {
            console.error('[Registration] frpc restart failed:', err);
          }
        });

        // 监听 SaaS 下发 FRP 停止指令
        socket.on('runner/frp:stop', async (callback: (data: { ok: boolean; message: string }) => void) => {
          try {
            await this.frpcService.stop();
            console.log('[Registration] frpc stopped via SaaS command');
            callback({ ok: true, message: 'FRPC stopped' });
          } catch (err) {
            callback({ ok: false, message: String(err) });
          }
        });

        // 监听 SaaS 下发 FRP 重载指令
        socket.on('runner/frp:reload', async (callback: (data: { ok: boolean; message: string }) => void) => {
          try {
            await this.frpcService.reloadViaApi();
            console.log('[Registration] frpc reloaded via SaaS command');
            callback({ ok: true, message: 'FRPC reloaded' });
          } catch (err) {
            callback({ ok: false, message: String(err) });
          }
        });

        // 监听 SaaS 请求性能统计
        socket.on('runner/stats:get', (callback: (data: { cpuUsage: number; memoryUsage: number; frpcRunning: boolean }) => void) => {
          const sysStats = RunnerStatsService.getInstance().getStats();
          callback({
            cpuUsage: sysStats.cpuUsage,
            memoryUsage: sysStats.memoryUsage,
            frpcRunning: this.frpcService.isRunning(),
          });
        });
      });
      socket.on('connect_error', (error: Error) => {
        this.lastStatus = 'failed';
        this.lastError = error.message;
        resolve({ ok: false, message: error.message });
      });
    });
  }
}

