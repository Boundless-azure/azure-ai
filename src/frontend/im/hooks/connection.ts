/**
 * @title IM 连接选项构造
 * @description 为 socket.io-client 构造符合后端认证逻辑的连接参数。
 * @keywords-cn 连接选项, Authorization头, 握手auth
 * @keywords-en connection-options, authorization-header, handshake-auth
 */

export interface SocketConnectOptions {
  extraHeaders?: Record<string, string>;
  auth?: Record<string, unknown>;
  transports?: string[];
  withCredentials?: boolean;
}

/** 客户端 Socket 轻量接口（用于不直接依赖 socket.io-client） */
export interface ClientSocket {
  emit(event: string, ...args: unknown[]): unknown;
  on?(event: string, listener: (...args: unknown[]) => void): unknown;
  auth?: Record<string, unknown>;
  connect?: () => void;
}

/** socket.io-client 工厂方法签名（io(url, opts)） */
export type SocketFactory = (url: string, opts?: unknown) => ClientSocket;

/**
 * 构造连接选项：默认使用握手参数 auth.token 传递 JWT。
 * 可选 mode='header' 时改为使用 Authorization Bearer 头。
 */
export function buildImConnectionOptions(
  token: string,
  mode: 'header' | 'auth' = 'auth',
): SocketConnectOptions {
  if (mode === 'auth') {
    return {
      auth: { token },
      transports: ['websocket'],
      withCredentials: true,
    };
  }
  return {
    extraHeaders: { Authorization: `Bearer ${token}` },
    transports: ['websocket'],
    withCredentials: true,
  };
}

/**
 * 构造 IM namespace 连接地址（例如 http://host:port/im）
 */
export function buildImNamespaceUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, '');
  return `${trimmed}/im`;
}

/**
 * 基于传入的 io 工厂方法创建并连接 IM Socket（使用 auth.token）。
 */
export function createImSocket(
  io: SocketFactory,
  baseUrl: string,
  token: string,
): ClientSocket {
  const url = buildImNamespaceUrl(baseUrl);
  const opts = buildImConnectionOptions(token, 'auth');
  return io(url, opts as unknown);
}

/**
 * 为已创建的客户端 Socket 设置 auth.token 并触发连接（适配 autoConnect=false 场景）。
 */
export function setAuthAndConnect(socket: ClientSocket, token: string): void {
  socket.auth = { token };
  socket.connect?.();
}
