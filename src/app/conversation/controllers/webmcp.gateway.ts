import {
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '@/core/auth/services/auth.service';
import { WebMcpSessionDataService } from '../services/webmcp-session-data.service';

/**
 * @title WebMCP Socket.IO 网关
 * @description 处理前端 WebMCP 客户端连接、注册事件与实时调用回路。
 *   连接时通过 auth.token + auth.sessionId 进行双重鉴权；
 *   注册成功后将 Schema 写入 chat_sessions_data。
 * @keywords-cn WebMCP网关, Socket, 连接鉴权, Schema注册
 * @keywords-en webmcp-gateway, socket, auth, schema-register
 */
@Injectable()
@WebSocketGateway({ cors: true, namespace: '/webmcp' })
export class WebMcpGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WebMcpGateway.name);

  @WebSocketServer()
  server!: Server;

  /** socketId → sessionId 映射（内存索引，用于 Hook 快速查找） */
  private readonly socketSessionMap = new Map<string, string>();

  /** socketId → Socket 实例映射，避免依赖 server.sockets 类型 */
  private readonly socketMap = new Map<string, Socket>();

  /**
   * callId → Promise resolver 映射，用于等待前端返回调用结果
   * key: `${socketId}:${callId}`
   * @keyword-en pending-call-map
   */
  private readonly pendingCalls = new Map<
    string,
    { resolve: (v: unknown) => void; timer: ReturnType<typeof setTimeout> }
  >();

  constructor(
    private readonly authService: AuthService,
    private readonly dataService: WebMcpSessionDataService,
  ) {}

  // ========== 连接生命周期 ==========

  /**
   * 握手阶段双重鉴权：验证 JWT token 并校验 sessionId 存在
   * @keyword-en handle-connection-auth
   */
  async handleConnection(client: Socket & { disconnect(close?: boolean): void }): Promise<void> {
    const token     = this._extractToken(client);
    const sessionId = client.handshake.auth?.['sessionId'] as string | undefined;

    if (!token || !sessionId) {
      this.logger.warn(`[webmcp] missing token or sessionId socket=${client.id}`);
      client.emit('webmcp:error', { code: 'AUTH_MISSING', msg: 'token and sessionId required' });
      client.disconnect();
      return;
    }

    try {
      this.authService.verifyToken(token);
    } catch {
      this.logger.warn(`[webmcp] invalid token socket=${client.id}`);
      client.emit('webmcp:error', { code: 'AUTH_INVALID', msg: 'invalid token' });
      client.disconnect();
      return;
    }

    const exists = await this.dataService.sessionExists(sessionId);
    if (!exists) {
      this.logger.warn(`[webmcp] session not found sessionId=${sessionId} socket=${client.id}`);
      client.emit('webmcp:error', { code: 'SESSION_NOT_FOUND', msg: 'session not found' });
      client.disconnect();
      return;
    }

    // 鉴权通过，记录映射
    client.data = { ...client.data, sessionId };
    this.socketSessionMap.set(client.id, sessionId);
    this.socketMap.set(client.id, client);
    await this.dataService.saveConn(sessionId, client.id);

    this.logger.debug(`[webmcp] connected socket=${client.id} session=${sessionId}`);
    client.emit('webmcp:connected', { ok: true, socketId: client.id });
  }

  /**
   * 断开连接时清理映射
   * @keyword-en handle-disconnect
   */
  handleDisconnect(client: Socket): void {
    const sessionId = this.socketSessionMap.get(client.id);
    this.socketSessionMap.delete(client.id);
    this.socketMap.delete(client.id);
    this.logger.debug(`[webmcp] disconnected socket=${client.id} session=${sessionId ?? '?'}`);
  }

  // ========== 事件处理 ==========

  /**
   * 客户端注册 MCP Schema，存入 chat_sessions_data
   * @keyword-en on-webmcp-register
   */
  @SubscribeMessage('webmcp:register')
  async onRegister(
    @MessageBody() payload: { descriptor: unknown; pageName?: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const sessionId = client.data?.sessionId as string | undefined;
    if (!sessionId) return;

    await this.dataService.saveSchema(sessionId, {
      descriptor: payload.descriptor,
      pageName:   payload.pageName,
      socketId:   client.id,
      registeredAt: new Date().toISOString(),
    });

    client.emit('webmcp:registered', { ok: true });
    this.logger.debug(`[webmcp] schema registered session=${sessionId} page=${payload.pageName}`);
  }

  /**
   * 收到前端 webmcp:call_result 后，通过 callId 唤醒等待 Promise
   * @keyword-en on-call-result
   */
  @SubscribeMessage('webmcp:call_result')
  onCallResult(
    @MessageBody() payload: { callId?: string; result?: unknown },
    @ConnectedSocket() client: Socket,
  ): void {
    const key = `${client.id}:${payload?.callId}`;
    const pending = this.pendingCalls.get(key);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pendingCalls.delete(key);
    pending.resolve(payload?.result);
  }

  /**
   * 向客户端发送调用指令并等待前端执行结果（请求-响应模式）
   * @param socketId 目标 socket ID
   * @param call     调用描述 { type, payload }
   * @param timeoutMs 等待超时毫秒，默认 8000
   * @keyword-en send-call-and-wait
   */
  sendCallAndWait(
    socketId: string,
    call: { type: 'data' | 'emit'; payload: unknown },
    timeoutMs = 8000,
  ): Promise<unknown> {
    const target = this.socketMap.get(socketId);
    if (!target) return Promise.reject(new Error('socket not found'));

    const callId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const key    = `${socketId}:${callId}`;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCalls.delete(key);
        reject(new Error(`webmcp call timeout (${timeoutMs}ms) callId=${callId}`));
      }, timeoutMs);

      this.pendingCalls.set(key, { resolve, timer });
      target.emit('webmcp:call', { ...call, callId });
    });
  }

  /**
   * fire-and-forget 版本（兼容不需要等待结果的场景）
   * @keyword-en send-call-to-client
   */
  sendCall(socketId: string, call: { type: 'data' | 'emit'; payload: unknown }): boolean {
    const target = this.socketMap.get(socketId);
    if (!target) return false;
    target.emit('webmcp:call', call);
    return true;
  }

  /**
   * 通过 sessionId 获取最新活跃 socketId（内存索引）
   * @keyword-en get-socket-id-by-session
   */
  getSocketIdBySession(sessionId: string): string | null {
    for (const [socketId, sid] of this.socketSessionMap.entries()) {
      if (sid === sessionId) return socketId;
    }
    return null;
  }

  // ========== 私有方法 ==========

  /** 从握手中提取 JWT Token @keyword-en extract-token */
  private _extractToken(client: Socket): string | null {
    const maybeAuth = client.handshake.auth?.['token'];
    if (typeof maybeAuth === 'string' && maybeAuth.length > 0) return maybeAuth;
    const header = client.handshake.headers['authorization'];
    if (typeof header === 'string') {
      const [scheme, t] = header.split(' ');
      if (/^Bearer$/i.test(scheme) && t) return t;
    }
    return null;
  }
}
