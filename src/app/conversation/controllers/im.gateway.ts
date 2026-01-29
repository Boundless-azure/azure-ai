import {
  Injectable,
  Logger,
  UsePipes,
  ValidationPipe,
  Inject,
  forwardRef,
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
import { ImSessionService } from '../services/im-session.service';
import { ImMessageService } from '../services/im-message.service';
import { appValidationPipeOptions } from '@/core/common/pipes/validation.options';
import type { ImWsEvent } from '../types/im.types';
import { JoinSessionDto, TypingDto, ReadReceiptDto } from '../types/im.types';
import { AuthService } from '@/core/auth/services/auth.service';

/**
 * @title IM WebSocket 网关
 * @description IM 消息实时推送、房间管理、输入状态、已读回执。
 * @keywords-cn WebSocket, IM, 实时, 消息, 房间
 * @keywords-en WebSocket, im, realtime, message, room
 */
@Injectable()
@WebSocketGateway({ cors: true, namespace: '/im' })
export class ImGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ImGateway.name);

  @WebSocketServer()
  private server!: Server;

  /** 使用 Socket.io v4 的 client.data 存储主体信息 */

  constructor(
    private readonly sessionService: ImSessionService,
    @Inject(forwardRef(() => ImMessageService))
    private readonly messageService: ImMessageService,
    private readonly authService: AuthService,
  ) {}

  private notifyRoom(principalId: string): string {
    return `${principalId}-notify`;
  }

  private ensureAuthedPrincipal(client: Socket): string | null {
    const principalId = client.data?.principalId;
    return typeof principalId === 'string' ? principalId : null;
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
    // 优先从握手参数 auth.token 解析，其次尝试 Authorization Bearer
    let token: string | null = null;
    const maybeAuth = client.handshake.auth?.['token'];
    if (typeof maybeAuth === 'string' && maybeAuth.length > 0) {
      token = maybeAuth;
    } else {
      const header = client.handshake.headers['authorization'];
      if (typeof header === 'string') {
        const [scheme, t] = header.split(' ');
        if (/^Bearer$/i.test(scheme)) token = t ?? null;
      }
    }

    if (token) {
      try {
        const payload = this.authService.verifyToken(token);
        client.data = { ...client.data, principalId: payload.id };
        void client.join(this.notifyRoom(payload.id));
      } catch {
        this.emitError(client, 'Invalid token');
      }
    } else {
      this.emitError(client, 'Missing token');
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /**
   * 加入房间（私聊/群聊统一；校验是否为会话成员）
   */
  @SubscribeMessage('user-room/join-room')
  @UsePipes(new ValidationPipe({ ...appValidationPipeOptions }))
  async onJoin(
    @MessageBody() dto: JoinSessionDto,
    @ConnectedSocket() client: Socket,
  ) {
    const principalId = this.ensureAuthedPrincipal(client);
    if (!principalId) {
      this.emitError(client, 'Not authenticated');
      return;
    }

    // 验证是会话成员
    const isMember = await this.sessionService.isMember(
      dto.sessionId,
      principalId,
    );
    if (!isMember) {
      this.emitError(client, 'Not a member of this session');
      return;
    }

    // 加入 socket.io 房间
    await client.join(`session:${dto.sessionId}`);
    this.logger.debug(
      `Client ${client.id} joined room session:${dto.sessionId}`,
    );
  }

  /**
   * 离开房间
   */
  @SubscribeMessage('user-room/leave-room')
  async onLeave(
    @MessageBody() dto: JoinSessionDto,
    @ConnectedSocket() client: Socket,
  ) {
    await client.leave(`session:${dto.sessionId}`);
    this.logger.debug(`Client ${client.id} left room session:${dto.sessionId}`);
  }

  @SubscribeMessage('user-room/join-notify')
  async onJoinNotify(@ConnectedSocket() client: Socket) {
    const principalId = this.ensureAuthedPrincipal(client);
    if (!principalId) {
      this.emitError(client, 'Not authenticated');
      return;
    }
    await client.join(this.notifyRoom(principalId));
  }

  @SubscribeMessage('user-room/leave-notify')
  async onLeaveNotify(@ConnectedSocket() client: Socket) {
    const principalId = this.ensureAuthedPrincipal(client);
    if (!principalId) {
      this.emitError(client, 'Not authenticated');
      return;
    }
    await client.leave(this.notifyRoom(principalId));
  }

  /**
   * 输入状态
   */
  @SubscribeMessage('im:typing')
  @UsePipes(new ValidationPipe({ ...appValidationPipeOptions }))
  onTyping(@MessageBody() dto: TypingDto, @ConnectedSocket() client: Socket) {
    const principalId = this.ensureAuthedPrincipal(client);
    if (!principalId) return;

    this.broadcastToSession(dto.sessionId, {
      type: 'im:typing',
      data: { userId: principalId, isTyping: dto.isTyping },
      sessionId: dto.sessionId,
    });
  }

  /**
   * 已读回执
   */
  @SubscribeMessage('im:read')
  @UsePipes(new ValidationPipe({ ...appValidationPipeOptions }))
  async onRead(
    @MessageBody() dto: ReadReceiptDto,
    @ConnectedSocket() client: Socket,
  ) {
    const principalId = this.ensureAuthedPrincipal(client);
    if (!principalId) return;

    await this.messageService.updateReadReceipt(
      dto.sessionId,
      principalId,
      dto.messageId,
    );

    void principalId;
  }

  public broadcastNewMessageBeacon(
    recipientIds: string[],
    payload: { sessionId: string; lastMessageId: string },
  ): void {
    this.server
      .to(`session:${payload.sessionId}`)
      .emit('session-room/new_message', payload);
  }

  public broadcastUserNotify(
    recipientId: string,
    payload: { sessionId: string },
  ): void {
    this.server
      .to(this.notifyRoom(recipientId))
      .emit('user-room/notify', payload);
  }

  private broadcastToSession(sessionId: string, event: ImWsEvent): void {
    this.server.to(`session:${sessionId}`).emit('im:event', event);
  }

  /**
   * 发送错误
   */
  private emitError(client: Socket, error: string, sessionId?: string): void {
    client.emit('im:event', { type: 'error', error, sessionId });
  }
}
