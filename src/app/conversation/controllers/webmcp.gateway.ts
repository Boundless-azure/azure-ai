import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
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
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import type { HookResult } from '@/core/hookbus/types/hook.types';

/**
 * @title WebMCP Hook payload schema (SSOT)
 * @description WebMCP gateway 内直接声明页面控制 hook 的数组形参 schema。
 * @keywords-cn WebMCPHook, payloadSchema, SSOT
 * @keywords-en webmcp-hook, payload-schema, ssot
 */
const webControlSchema = z.object({
  sessionId: z.string().describe('目标会话 ID, 必填'),
  type: z
    .enum(['data', 'emit'])
    .describe('指令类型: data=设置数据, emit=触发事件'),
  payload: z
    .unknown()
    .describe('指令载荷, type=data 时为待写入数据, type=emit 时为事件参数'),
  timeout: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('等待前端响应的超时, 默认 8000ms'),
});

const webControlPageInfoSchema = z.object({
  sessionId: z.string().describe('目标会话 ID, 必填'),
});

const webControlDataSchema = z.object({
  sessionId: z.string().describe('目标会话 ID, 必填'),
  dataKey: z.string().describe('要读取的前端 data key, 必填'),
});

const webControlStatusSchema = z.object({
  sessionId: z.string().describe('目标会话 ID, 必填'),
});

type WebControlPayload = z.infer<typeof webControlSchema>;
type WebControlPageInfoPayload = z.infer<typeof webControlPageInfoSchema>;
type WebControlDataPayload = z.infer<typeof webControlDataSchema>;
type WebControlStatusPayload = z.infer<typeof webControlStatusSchema>;

/**
 * @title WebMCP Socket.IO 网关
 * @description 处理前端 WebMCP 客户端连接、注册事件与实时调用回路, 并直接声明 WebMCP Hook。
 *   连接时通过 auth.token + auth.sessionId 进行双重鉴权；
 *   注册成功后将 Schema 写入 chat_sessions_data。
 * @keywords-cn WebMCP网关, Socket, 连接鉴权, Schema注册, Hook
 * @keywords-en webmcp-gateway, socket, auth, schema-register, hook
 */
@Injectable()
@HookController({ pluginName: 'webmcp', tags: ['conversation', 'webmcp'] })
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
  async handleConnection(
    client: Socket & { disconnect(close?: boolean): void },
  ): Promise<void> {
    const token = this._extractToken(client);
    const sessionId = client.handshake.auth?.['sessionId'] as
      | string
      | undefined;

    if (!token || !sessionId) {
      this.logger.warn(
        `[webmcp] missing token or sessionId socket=${client.id}`,
      );
      client.emit('webmcp:error', {
        code: 'AUTH_MISSING',
        msg: 'token and sessionId required',
      });
      client.disconnect();
      return;
    }

    try {
      this.authService.verifyToken(token);
    } catch {
      this.logger.warn(`[webmcp] invalid token socket=${client.id}`);
      client.emit('webmcp:error', {
        code: 'AUTH_INVALID',
        msg: 'invalid token',
      });
      client.disconnect();
      return;
    }

    const exists = await this.dataService.sessionExists(sessionId);
    if (!exists) {
      this.logger.warn(
        `[webmcp] session not found sessionId=${sessionId} socket=${client.id}`,
      );
      client.emit('webmcp:error', {
        code: 'SESSION_NOT_FOUND',
        msg: 'session not found',
      });
      client.disconnect();
      return;
    }

    // 鉴权通过，记录映射
    client.data = { ...client.data, sessionId };
    this.socketSessionMap.set(client.id, sessionId);
    this.socketMap.set(client.id, client);
    await this.dataService.saveConn(sessionId, client.id);

    this.logger.debug(
      `[webmcp] connected socket=${client.id} session=${sessionId}`,
    );
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
    this.logger.debug(
      `[webmcp] disconnected socket=${client.id} session=${sessionId ?? '?'}`,
    );
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
      pageName: payload.pageName,
      socketId: client.id,
      registeredAt: new Date().toISOString(),
    });

    client.emit('webmcp:registered', { ok: true });
    this.logger.debug(
      `[webmcp] schema registered session=${sessionId} page=${payload.pageName}`,
    );
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
    const key = `${socketId}:${callId}`;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCalls.delete(key);
        reject(
          new Error(`webmcp call timeout (${timeoutMs}ms) callId=${callId}`),
        );
      }, timeoutMs);

      this.pendingCalls.set(key, { resolve, timer });
      target.emit('webmcp:call', { ...call, callId });
    });
  }

  /**
   * fire-and-forget 版本（兼容不需要等待结果的场景）
   * @keyword-en send-call-to-client
   */
  sendCall(
    socketId: string,
    call: { type: 'data' | 'emit'; payload: unknown },
  ): boolean {
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

  /**
   * 向前端页面发送控制指令（setData / callEmit）。
   * @keyword-en hook-web-control
   */
  @HookRoute({
    hook: 'saas.app.conversation.webControl',
    description:
      '向前端页面发送控制指令。type=data 为设置数据, type=emit 为触发事件; timeout 默认 8000ms。前端需已连接 WebMCP, 调用前建议用 saas.app.conversation.webControlStatus 确认。',
    args: [webControlSchema],
    metadata: { tags: ['webmcp', 'control', 'call'] },
  })
  @CheckAbility('update', 'session')
  async handleWebControl(
    payloadInput: WebControlPayload,
  ): Promise<HookResult> {
    const { sessionId, type, payload, timeout } = payloadInput;
    const socketId = await this._resolveSocket(sessionId);
    if (!socketId) {
      return {
        status: HookResultStatus.Error,
        error: `no active connection for session ${sessionId}`,
      };
    }

    try {
      const result = await this.sendCallAndWait(
        socketId,
        { type, payload },
        typeof timeout === 'number' ? timeout : 8000,
      );
      this.logger.debug(`[webControl] ok type=${type} session=${sessionId}`);
      return {
        status: HookResultStatus.Success,
        data: { result, socketId },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { status: HookResultStatus.Error, error: msg };
    }
  }

  /**
   * 获取指定 session 当前最新注册的页面信息。
   * @keyword-en hook-web-control-pageinfo
   */
  @HookRoute({
    hook: 'saas.app.conversation.webControlPageinfo',
    description:
      '获取指定 session 当前注册的页面 Schema 信息（组件声明、可操作元素列表）。调用前建议先用 saas.app.conversation.webControlStatus 确认已连接。',
    args: [webControlPageInfoSchema],
    metadata: { tags: ['webmcp', 'page-info'] },
  })
  @CheckAbility('read', 'session')
  async handleWebControlPageInfo(
    payload: WebControlPageInfoPayload,
  ): Promise<HookResult> {
    const { sessionId } = payload;
    const schema = await this.dataService.getLatestSchema(sessionId);
    if (!schema) {
      return {
        status: HookResultStatus.Error,
        error: 'no schema found for session',
      };
    }
    return { status: HookResultStatus.Success, data: schema };
  }

  /**
   * 向前端请求指定 data key 的实时值。
   * @keyword-en hook-web-control-data
   */
  @HookRoute({
    hook: 'saas.app.conversation.webControlData',
    description:
      '向前端实时请求指定 data key 的当前值。返回 { requested: true, dataKey, socketId }, 实际值由前端异步推送。',
    args: [webControlDataSchema],
    metadata: { tags: ['webmcp', 'data-query'] },
  })
  @CheckAbility('read', 'session')
  async handleWebControlData(
    payload: WebControlDataPayload,
  ): Promise<HookResult> {
    const { sessionId, dataKey } = payload;
    const socketId = await this._resolveSocket(sessionId);
    if (!socketId) {
      return {
        status: HookResultStatus.Error,
        error: `no active connection for session ${sessionId}`,
      };
    }

    const sent = this.sendCall(socketId, {
      type: 'data',
      payload: { op: 'getData', key: dataKey },
    });
    if (!sent) {
      return {
        status: HookResultStatus.Error,
        error: 'socket not found or disconnected',
      };
    }

    return {
      status: HookResultStatus.Success,
      data: { requested: true, dataKey, socketId },
    };
  }

  /**
   * 查询指定 session 的 WebMCP 连接状态。
   * @keyword-en hook-web-control-status
   */
  @HookRoute({
    hook: 'saas.app.conversation.webControlStatus',
    description:
      '查询指定 session 的 WebMCP 连接状态。返回 { dbLastSocketId, activeSocketId, connected: boolean }; connected=false 时无法使用 saas.app.conversation.webControl 系列指令。',
    args: [webControlStatusSchema],
    metadata: { tags: ['webmcp', 'status'] },
  })
  @CheckAbility('read', 'session')
  async handleWebControlStatus(
    payload: WebControlStatusPayload,
  ): Promise<HookResult> {
    const { sessionId } = payload;
    const dbStatus = await this.dataService.getConnStatus(sessionId);
    const activeSocketId = this.getSocketIdBySession(sessionId);
    return {
      status: HookResultStatus.Success,
      data: {
        sessionId,
        dbLastSocketId: dbStatus.socketId,
        activeSocketId: activeSocketId ?? null,
        connected: activeSocketId !== null,
        hasSchema: (await this.dataService.getLatestSchema(sessionId)) !== null,
      },
    };
  }

  // ========== 私有方法 ==========

  /**
   * 优先从内存映射获取最新 socketId，否则回退到 DB。
   * @keyword-en resolve-socket-id
   */
  private async _resolveSocket(sessionId: string): Promise<string | null> {
    const memSocket = this.getSocketIdBySession(sessionId);
    if (memSocket) return memSocket;
    return this.dataService.getLatestConn(sessionId);
  }

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
