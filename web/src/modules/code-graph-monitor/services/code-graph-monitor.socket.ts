// AGENT-MONITOR-TEMP :: 临时调试监听, 后期整体删除 (grep AGENT-MONITOR-TEMP)
import { io, type Socket } from 'socket.io-client';
import type { CodeGraphProgressMessage } from '../types/code-graph-monitor.types';

/**
 * @title Code Graph 监听 WebSocket 客户端
 * @description 连接 saas `/code-graph` 命名空间 (token 握手鉴权), 按 sessionId 加入房间, 收 `code-graph:event`
 *   进度事件 (加入即 backfill 回放 + 之后实时). 与 IM socket 同样的 base/path 约定。
 * @keywords-cn 监听客户端, WebSocket, 实时
 * @keywords-en monitor-client, websocket, realtime
 */

const SOCKET_PATH = '/api/socket.io';
const NAMESPACE = '/code-graph';
const PROGRESS_EVENT = 'code-graph:event';

export type CodeGraphMonitorCallbacks = {
  onEvent: (msg: CodeGraphProgressMessage) => void;
  onStatus?: (status: 'connecting' | 'connected' | 'disconnected') => void;
  onError?: (message: string) => void;
};

/**
 * 解析 WS base url: 优先 PUBLIC_WS_BASE_URL, 否则当前 origin。
 * @keyword-cn WS基址, 监听客户端
 * @keyword-en ws-base-url, monitor-client
 */
function baseWsUrl(): string {
  const env = (import.meta as { env?: Record<string, unknown> }).env
    ?.PUBLIC_WS_BASE_URL;
  if (typeof env === 'string' && env.length > 0) return env;
  return typeof window !== 'undefined' ? window.location.origin : '';
}

export class CodeGraphMonitorSocket {
  private socket: Socket | null = null;
  private joinedSessionId: string | null = null;

  /**
   * 连接并订阅某会话进度。token 取自登录态 (localStorage)。重复调用先断开旧连接。
   * @keyword-cn 连接订阅, 监听客户端
   * @keyword-en connect-subscribe, monitor-client
   */
  connect(
    sessionId: string,
    token: string,
    callbacks: CodeGraphMonitorCallbacks,
  ): void {
    this.disconnect();
    callbacks.onStatus?.('connecting');
    this.joinedSessionId = sessionId;
    this.socket = io(`${baseWsUrl()}${NAMESPACE}`, {
      path: SOCKET_PATH,
      transports: ['websocket'],
      withCredentials: true,
      reconnection: true,
      auth: { token },
    });
    this.socket.on('connect', () => {
      callbacks.onStatus?.('connected');
      this.socket?.emit('code-graph/join', { sessionId });
    });
    this.socket.on('disconnect', () => callbacks.onStatus?.('disconnected'));
    this.socket.on('connect_error', (err: Error) =>
      callbacks.onError?.(err instanceof Error ? err.message : String(err)),
    );
    this.socket.on('code-graph:error', (payload: { message?: string }) =>
      callbacks.onError?.(payload?.message ?? 'unknown error'),
    );
    this.socket.on(PROGRESS_EVENT, (msg: CodeGraphProgressMessage) => {
      if (msg?.sessionId === this.joinedSessionId) callbacks.onEvent(msg);
    });
  }

  /**
   * 断开连接并清理。
   * @keyword-cn 断开清理, 监听客户端
   * @keyword-en disconnect-cleanup, monitor-client
   */
  disconnect(): void {
    if (this.socket) {
      if (this.joinedSessionId) {
        this.socket.emit('code-graph/leave', {
          sessionId: this.joinedSessionId,
        });
      }
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.joinedSessionId = null;
  }
}
