import { io, type Socket } from 'socket.io-client';
import { z } from 'zod';
import { HOOKBUS_DEBUG_SOCKET_PATH } from '../modules/hookbus-debug/constants/hookbus-debug.constants';
import { http } from '../utils/http';

/**
 * @title HookBus Debug API
 * @description 提供 HookBus 调试 Socket 连接创建与地址规范化。
 * @keywords-cn hookbus调试api, socket连接, 地址规范化
 * @keywords-en hookbus-debug-api, socket-connect, endpoint-normalize
 */
export const hookbusDebugApi = {
  normalizeEndpoint(input: string): string {
    const parsed = z.string().url().safeParse(input.trim());
    if (parsed.success) {
      const url = new URL(parsed.data);
      if (url.protocol === 'ws:') url.protocol = 'http:';
      if (url.protocol === 'wss:') url.protocol = 'https:';
      const path = url.pathname.replace(/\/+$/, '');
      if (path.endsWith(HOOKBUS_DEBUG_SOCKET_PATH)) {
        url.pathname = path.slice(0, -HOOKBUS_DEBUG_SOCKET_PATH.length) || '/';
      }
      return `${url.origin}${url.pathname === '/' ? '' : url.pathname}`.replace(
        /\/$/,
        '',
      );
    }
    throw new Error('Invalid endpoint URL');
  },

  connect(endpoint: string, key?: string): Socket {
    const url = new URL(endpoint);
    const basePath = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '');
    return io(url.origin, {
      path: `${basePath}${HOOKBUS_DEBUG_SOCKET_PATH}`,
      transports: ['websocket'],
      withCredentials: true,
      auth: key ? { key } : undefined,
      query: key ? { key } : undefined,
    });
  },

  getGatewayState() {
    return http.get<{ ok: boolean; enabled: boolean }>('/hookbus-debug/state');
  },

  setGatewayState(enabled: boolean) {
    return http.post<{ ok: boolean; enabled: boolean }>('/hookbus-debug/state', {
      enabled,
    });
  },
};
