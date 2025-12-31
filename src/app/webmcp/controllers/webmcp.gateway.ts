import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { WebMcpService } from '../services/webmcp.service';
import { WebMcpWsEvent, WEBMCP_NAMESPACE } from '../enums/webmcp.enums';
import type {
  WebMcpWirePageDeclaration,
  WebMcpDescriptorResponse,
} from '../types/webmcp.types';

/**
 * @title WebMCP WebSocket 网关
 * @description 提供与前端 WebMCP SDK 的双向通信：注册页面、拉取描述、下发操作与回执。
 * @keywords-cn WebSocket网关, WebMCP, 页面注册, 描述拉取, 操作下发
 * @keywords-en websocket-gateway, webmcp, page-register, descriptor-fetch, dispatch-ops
 */
@Injectable()
@WebSocketGateway({ cors: true, namespace: WEBMCP_NAMESPACE })
export class WebMcpGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WebMcpGateway.name);

  constructor(private readonly webmcp: WebMcpService) {}

  @WebSocketServer()
  private server!: Server;

  afterInit() {
    this.webmcp.attachServer(this.server);
  }

  handleConnection(_client: Socket) {
    this.logger.log(`WebMCP client connected`);
  }

  handleDisconnect(_client: Socket) {
    this.logger.log(`WebMCP client disconnected`);
  }

  /** 前端注册页面描述（初次或更新） */
  @SubscribeMessage(WebMcpWsEvent.Register)
  onRegister(
    @MessageBody()
    payload: { page: string; descriptor: WebMcpWirePageDeclaration },
    @ConnectedSocket() client: Socket,
  ) {
    const ts = Date.now();
    const response: WebMcpDescriptorResponse = {
      page: payload.page,
      descriptor: payload.descriptor,
      ts,
    };
    this.webmcp.cacheDescriptor(
      'unknown',
      payload.page,
      payload.descriptor,
      ts,
    );
    this.logger.log(`Registered WebMCP page: ${payload.page}`);
    client.emit(WebMcpWsEvent.Descriptor, response);
  }

  /** 客户端主动回传描述（响应 webmcp/get） */
  @SubscribeMessage(WebMcpWsEvent.Descriptor)
  onDescriptor(
    @MessageBody() payload: WebMcpDescriptorResponse,
    @ConnectedSocket() _client: Socket,
  ) {
    this.webmcp.notifyDescriptor(payload);
  }

  /** 操作执行回执 */
  @SubscribeMessage(WebMcpWsEvent.OpResult)
  onOpResult(
    @MessageBody() payload: { ok: boolean; pointer?: string; error?: string },
  ) {
    this.webmcp.notifyOpResult(payload);
  }
}
