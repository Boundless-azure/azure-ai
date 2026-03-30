/**
 * @title Runner WebSocket Service
 * @description Socket.io client for Runner WebSocket events, including FRP control.
 * @keywords-cn Runner WebSocket, FRP控制, 在线状态
 * @keywords-en runner-websocket, frp-control, online-status
 */
import { io, type Socket } from 'socket.io-client';
import { ref } from 'vue';

export enum RunnerWsEvent {
  Register = 'runner/register',
  Registered = 'runner/registered',
  Status = 'runner/status',
  FrpStart = 'runner/frp:start',
  FrpStop = 'runner/frp:stop',
  FrpReload = 'runner/frp:reload',
}

export interface RunnerRegisterPayload {
  runnerId?: string;
  key: string;
}

export interface RunnerFrpStartPayload {
  runnerId: string;
}

export interface RunnerStatusPayload {
  runnerId: string;
  status: 'mounted' | 'offline';
}

export class RunnerSocketService {
  private socket: Socket | null = null;
  private _connected = ref(false);
  private _authenticated = ref(false);
  private runnerId = '';

  public get connected() {
    return this._connected;
  }

  public get authenticated() {
    return this._authenticated;
  }

  private getBaseWsUrl(): string {
    const envValue = import.meta.env?.PUBLIC_WS_BASE_URL;
    if (typeof envValue === 'string' && envValue.length > 0) {
      return envValue;
    }
    return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  }

  /**
   * @title 连接 Runner WebSocket
   * @description 连接到 Runner WebSocket 网关。
   * @param runnerId Runner ID
   * @param key Runner 注册密钥
   */
  connect(runnerId: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        this.disconnect();
      }

      this.runnerId = runnerId;
      const baseUrl = this.getBaseWsUrl();
      const namespace = '/runner/ws';

      this.socket = io(`${baseUrl}${namespace}`, {
        path: '/api/socket.io',
        transports: ['websocket', 'polling'],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
      });

      this.socket.on('connect', () => {
        console.log('[RunnerWs] Connected');
        this._connected.value = true;

        // 注册 Runner
        this.socket?.emit(RunnerWsEvent.Register, { runnerId, key } as RunnerRegisterPayload, (response: any) => {
          if (response.ok) {
            console.log('[RunnerWs] Registered:', response);
            this._authenticated.value = true;
            resolve();
          } else {
            console.error('[RunnerWs] Registration failed:', response.error);
            this._authenticated.value = false;
            reject(new Error(response.error || 'Registration failed'));
          }
        });
      });

      this.socket.on('connect_error', (err: Error) => {
        console.error('[RunnerWs] Connect error:', err.message);
        this._connected.value = false;
        this._authenticated.value = false;
        reject(err);
      });

      this.socket.on('disconnect', () => {
        console.log('[RunnerWs] Disconnected');
        this._connected.value = false;
        this._authenticated.value = false;
      });

      this.socket.on('error', (err: Error) => {
        console.error('[RunnerWs] Error:', err.message);
      });
    });
  }

  /**
   * @title 断开连接
   * @description 断开 Runner WebSocket 连接。
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this._connected.value = false;
    this._authenticated.value = false;
  }

  /**
   * @title 启动 FRP
   * @description 向 Runner 发送 FRP 启动指令。
   */
  startFrp(): Promise<{ ok: boolean; message: string }> {
    return new Promise((resolve, reject) => {
      if (!this._authenticated.value) {
        reject(new Error('Not authenticated'));
        return;
      }

      this.socket?.emit(
        RunnerWsEvent.FrpStart,
        { runnerId: this.runnerId } as RunnerFrpStartPayload,
        (response: any) => {
          if (response.ok) {
            resolve({ ok: true, message: response.message });
          } else {
            reject(new Error(response.message || 'FRP start failed'));
          }
        },
      );
    });
  }

  /**
   * @title 停止 FRP
   * @description 向 Runner 发送 FRP 停止指令。
   */
  stopFrp(): Promise<{ ok: boolean; message: string }> {
    return new Promise((resolve, reject) => {
      if (!this._authenticated.value) {
        reject(new Error('Not authenticated'));
        return;
      }

      this.socket?.emit(
        RunnerWsEvent.FrpStop,
        { runnerId: this.runnerId } as RunnerFrpStartPayload,
        (response: any) => {
          if (response.ok) {
            resolve({ ok: true, message: response.message });
          } else {
            reject(new Error(response.message || 'FRP stop failed'));
          }
        },
      );
    });
  }

  /**
   * @title 重载 FRP
   * @description 向 Runner 发送 FRP 重载指令。
   */
  reloadFrp(): Promise<{ ok: boolean; message: string }> {
    return new Promise((resolve, reject) => {
      if (!this._authenticated.value) {
        reject(new Error('Not authenticated'));
        return;
      }

      this.socket?.emit(
        RunnerWsEvent.FrpReload,
        { runnerId: this.runnerId } as RunnerFrpStartPayload,
        (response: any) => {
          if (response.ok) {
            resolve({ ok: true, message: response.message });
          } else {
            reject(new Error(response.message || 'FRP reload failed'));
          }
        },
      );
    });
  }
}

// Singleton instance
export const runnerSocketService = new RunnerSocketService();
