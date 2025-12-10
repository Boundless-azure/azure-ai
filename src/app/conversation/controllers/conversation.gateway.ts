import { Injectable, Logger } from '@nestjs/common';
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
import type {
  ChatRequest,
  ConversationSseEvent,
} from '../types/conversation.types';

/**
 * @title 对话 WebSocket 网关
 * @description 通过 WebSocket 提供与 SSE 等价的流式事件输出；客户端以消息启动会话，服务端按事件分片推送，事件中包含 sessionId。
 * @keywords-cn WebSocket, 流式, 对话, 会话ID, 事件分片
 * @keywords-en WebSocket, streaming, conversation, sessionId, event-chunks
 */
@Injectable()
@WebSocketGateway({ path: '/conversation/ws' })
export class ConversationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ConversationGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(private readonly conversationService: ConversationService) {}

  /**
   * 处理单个连接的消息路由：
   * - 期待客户端以 JSON 文本发送：{ type: 'chat_start', payload: ChatRequest }
   * - 服务端按 SSE 事件语义推送：ConversationSseEvent（携带 sessionId）
   */
  @SubscribeMessage('chat_start')
  async onChatStart(
    @MessageBody() payload: ChatRequest,
    @ConnectedSocket() client: Socket,
  ) {
    await this.streamChatToClient(client, payload);
    return undefined;
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
      // ConversationService 已在事件上携带 sessionId
      this.safeEmit(client, ev);
    }
  }

  private safeEmit(client: Socket, ev: ConversationSseEvent) {
    try {
      client.emit('conversation_event', ev);
    } catch (err) {
      this.logger.error('WS send error', err as any);
    }
  }
}
