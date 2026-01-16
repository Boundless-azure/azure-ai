import { Injectable, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ConversationService } from '../services/conversation.service';
import { ContextService } from '@core/ai/services/context.service';
import type {
  ChatRequest,
  ConversationSseEvent,
} from '../types/conversation.types';
import {
  ChatRequestDto,
  ThreadChatStartDto,
} from '../types/conversation.types';
import { appValidationPipeOptions } from '@/core/common/pipes/validation.options';
import { ChatConversationGroupEntity } from '@core/ai/entities/chat-conversation-group.entity';
import { ChatSessionEntity } from '@core/ai/entities/chat-session.entity';

/**
 * @title 对话 WebSocket 网关
 * @description 通过 WebSocket 提供与 SSE 等价的流式事件输出；客户端以消息启动会话，服务端按事件分片推送，事件中包含 sessionId。
 * @keywords-cn WebSocket, 流式, 对话, 会话ID, 事件分片
 * @keywords-en WebSocket, streaming, conversation, sessionId, event-chunks
 */
@Injectable()
@WebSocketGateway({ cors: true, namespace: '/conversation/ws' })
export class ConversationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ConversationGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly conversationService: ConversationService,
    private readonly contextService: ContextService,
    @InjectRepository(ChatConversationGroupEntity)
    private readonly convGroupRepo: Repository<ChatConversationGroupEntity>,
    @InjectRepository(ChatSessionEntity)
    private readonly sessionRepo: Repository<ChatSessionEntity>,
  ) {}

  /**
   * 处理单个连接的消息路由：
   * - 期待客户端以 JSON 文本发送：{ type: 'chat_start', payload: ChatRequest }
   * - 服务端按 SSE 事件语义推送：ConversationSseEvent（携带 sessionId）
   */
  @SubscribeMessage('chat_start')
  @UsePipes(new ValidationPipe({ ...appValidationPipeOptions }))
  async onChatStart(
    @MessageBody() payload: ChatRequestDto,
    @ConnectedSocket() client: Socket,
  ) {
    await this.streamChatToClient(client, payload);
    return undefined;
  }

  /**
   * @title 线程对话启动（WebSocket）
   * @description 基于线程ID启动对话流；服务端自动复用或创建并绑定会话到该线程。
   * @keywords-cn 线程对话, WebSocket, 流式, 会话绑定
   * @keywords-en thread-conversation, websocket, streaming, session-binding
   */
  @SubscribeMessage('thread_chat_start')
  @UsePipes(new ValidationPipe({ ...appValidationPipeOptions }))
  async onThreadChatStart(
    @MessageBody() payload: ThreadChatStartDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const group = await this.convGroupRepo.findOne({
        where: { id: payload.threadId, isDelete: false },
      });
      if (!group) {
        this.safeEmit(client, {
          type: 'error',
          error: 'Thread not found',
        });
        return undefined;
      }

      let sessionId = payload.sessionId;
      if (sessionId) {
        const ctx = await this.contextService.createContext(
          sessionId,
          payload.systemPrompt,
          'system',
        );
        sessionId = ctx.sessionId;
        const bound =
          await this.contextService.getConversationGroupIdForSession(sessionId);
        if (!bound) {
          await this.contextService.linkSessionToGroup(sessionId, group.id);
        }
      } else {
        const latest = await this.sessionRepo.findOne({
          where: {
            conversationGroupId: group.id,
            active: true,
            isDelete: false,
          },
          order: { updatedAt: 'DESC' },
        });
        if (latest) {
          sessionId = latest.sessionId;
        } else {
          const ctx = await this.contextService.createContext(
            undefined,
            payload.systemPrompt,
            'system',
          );
          sessionId = ctx.sessionId;
          await this.contextService.linkSessionToGroup(sessionId, group.id);
        }
      }

      const req: ChatRequest = {
        message: payload.message,
        sessionId,
        modelId: payload.modelId,
        systemPrompt: payload.systemPrompt,
        stream: true,
        chatClientId: group.chatClientId ?? '',
        threadType: group.threadType,
      };

      await this.streamChatToClient(client, req);
      return undefined;
    } catch (err) {
      this.safeEmit(client, {
        type: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
      return undefined;
    }
  }

  handleConnection() {
    // no-op
  }

  handleDisconnect() {
    // no-op
  }

  private async streamChatToClient(client: Socket, req: ChatRequest) {
    const gen = this.conversationService.chatStream({ ...req, stream: true });
    for await (const ev of gen) {
      if (!this.isConversationEvent(ev)) continue;
      this.safeEmit(client, ev);
    }
  }

  private isConversationEvent(e: unknown): e is ConversationSseEvent {
    if (!e || typeof e !== 'object') return false;
    const t = (e as { type?: unknown }).type;
    return (
      typeof t === 'string' &&
      (t === 'token' ||
        t === 'reasoning' ||
        t === 'tool_start' ||
        t === 'tool_chunk' ||
        t === 'tool_end' ||
        t === 'session_group' ||
        t === 'session_group_title' ||
        t === 'done' ||
        t === 'error')
    );
  }

  private safeEmit(client: Socket, ev: ConversationSseEvent) {
    try {
      client.emit('conversation_event', ev);
    } catch (err) {
      this.logger.error('WS send error', err as any);
    }
  }
}
