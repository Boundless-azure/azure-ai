// AGENT-MONITOR-TEMP :: 临时调试监听, 后期整体删除 (grep AGENT-MONITOR-TEMP)
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '@/core/auth/services/auth.service';
import type { CodeGraphProgressMessage } from '@/agents/code-agent/monitor/code-graph-progress.sink';
import { CodeGraphMonitorService } from '../services/code-graph-monitor.service';

/** 监听页事件名 (backfill 与实时推送同一个 event 外形) */
const PROGRESS_EVENT = 'code-graph:event';

/**
 * @title Code Graph 监听 WebSocket 网关
 * @description 给监听页实时推送 code-agent 每层节点日志与 LLM 调用事件。命名空间 `/code-graph`; 连接需带
 *   token 鉴权; 前端按 sessionId 加入房间, 加入即回放该会话缓冲 (backfill), 之后实时收 `code-graph:event`。
 * @keyword-cn 监听网关, 实时推送
 * @keyword-en monitor-gateway, realtime-push
 */
@Injectable()
@WebSocketGateway({ cors: true, namespace: '/code-graph' })
export class CodeGraphMonitorGateway
  implements OnGatewayConnection, OnModuleInit
{
  private readonly logger = new Logger(CodeGraphMonitorGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly monitor: CodeGraphMonitorService,
    private readonly authService: AuthService,
  ) {}

  /**
   * 订阅 service 的实时进度, 广播到对应 session 房间。
   * @keyword-cn 订阅广播, 监听网关
   * @keyword-en subscribe-broadcast, monitor-gateway
   */
  onModuleInit(): void {
    this.monitor.onProgress((msg) => this.broadcast(msg));
  }

  /**
   * 连接鉴权: 从握手 auth.token / Authorization Bearer 取 token, 校验后存 principalId; 失败发错误。
   * @keyword-cn 连接鉴权, 监听网关
   * @keyword-en connect-auth, monitor-gateway
   */
  handleConnection(client: Socket): void {
    let token: string | null = null;
    const maybeAuth = client.handshake.auth?.['token'];
    if (typeof maybeAuth === 'string' && maybeAuth.length > 0) {
      token = maybeAuth;
    } else {
      const header = client.handshake.headers['authorization'];
      if (typeof header === 'string') {
        const [scheme, value] = header.split(' ');
        if (/^Bearer$/i.test(scheme)) token = value ?? null;
      }
    }
    if (!token) {
      client.emit('code-graph:error', { message: 'Missing token' });
      return;
    }
    try {
      const payload = this.authService.verifyToken(token);
      client.data = { ...client.data, principalId: payload.id };
    } catch {
      client.emit('code-graph:error', { message: 'Invalid token' });
    }
  }

  /**
   * 加入某会话的监听房间并回放已缓冲进度; 之后该房间的实时事件自动到达。
   * @keyword-cn 加入回放, 监听网关
   * @keyword-en join-backfill, monitor-gateway
   */
  @SubscribeMessage('code-graph/join')
  async onJoin(
    @MessageBody() dto: { sessionId?: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const principalId = client.data?.principalId;
    if (typeof principalId !== 'string') {
      client.emit('code-graph:error', { message: 'Not authenticated' });
      return;
    }
    const sessionId = dto?.sessionId?.trim();
    if (!sessionId) {
      client.emit('code-graph:error', { message: 'Missing sessionId' });
      return;
    }
    await client.join(this.room(sessionId));
    for (const msg of this.monitor.getBackfill(sessionId)) {
      client.emit(PROGRESS_EVENT, msg);
    }
    this.logger.debug(`client ${client.id} joined code-graph ${sessionId}`);
  }

  /**
   * 离开某会话监听房间。
   * @keyword-cn 离开房间, 监听网关
   * @keyword-en leave-room, monitor-gateway
   */
  @SubscribeMessage('code-graph/leave')
  async onLeave(
    @MessageBody() dto: { sessionId?: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const sessionId = dto?.sessionId?.trim();
    if (sessionId) await client.leave(this.room(sessionId));
  }

  private room(sessionId: string): string {
    return `code-graph:${sessionId}`;
  }

  private broadcast(msg: CodeGraphProgressMessage): void {
    this.server.to(this.room(msg.sessionId)).emit(PROGRESS_EVENT, msg);
  }
}
