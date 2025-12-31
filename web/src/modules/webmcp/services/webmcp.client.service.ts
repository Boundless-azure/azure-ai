/**
 * @title WebMCP Client Service
 * @description Socket.io client for WebMCP handshake and operation dispatch.
 * @keywords-cn WebMCP客户端, Socket.io, 握手, 操作分发
 * @keywords-en webmcp-client, socketio, handshake, dispatch
 */
import { io, type Socket } from 'socket.io-client';
import { WebMcpRegistryService } from './webmcp.registry.service';
import type { WebMcpOperation, WebMcpOpResult } from '../types/webmcp.types';

const NAMESPACE = '/webmcp/ws';
const SOCKET_PATH = '/api/socket.io';

export class WebMcpClientService {
  private socket?: Socket;
  constructor(private readonly registry: WebMcpRegistryService) {}

  /**
   * @title 初始化连接
   * @description 初始化连接并绑定事件
   * @keywords-cn 初始化连接
   * @keywords-en init-connect
   */
  connect(baseUrl: string) {
    if (this.socket && this.socket.connected) return;
    this.socket = io(`${baseUrl}${NAMESPACE}`, {
      path: SOCKET_PATH,
      transports: ['websocket'],
      withCredentials: true,
    });
    this.bindEvents();
  }

  private bindEvents() {
    const socket = this.socket;
    if (!socket) return;
    socket.on('connect_error', (err) => {
      console.error('WebMCP Socket Error:', err.message);
    });

    socket.on('webmcp/get', (payload: { page?: string }) => {
      const wire = this.registry.toWire();
      if (!wire) return;
      if (payload?.page && payload.page !== wire.page) return;
      const resp = {
        page: wire.page,
        descriptor: wire,
        ts: Date.now(),
      };
      socket.emit('webmcp/descriptor', resp);
    });

    socket.on('webmcp/op', async (op: WebMcpOperation) => {
      const result = await this.registry.execute(op);
      const resp: WebMcpOpResult = { ok: result.ok, error: result.error };
      socket.emit('webmcp/op_result', resp);
    });
  }

  /**
   * @title 主动注册页面
   * @description 主动注册当前页面（可选）
   * @keywords-cn 主动注册
   * @keywords-en register-page
   */
  registerCurrentPage() {
    const wire = this.registry.toWire();
    if (!wire || !this.socket) return;
    this.socket.emit('webmcp/register', { page: wire.page, descriptor: wire });
  }
}
