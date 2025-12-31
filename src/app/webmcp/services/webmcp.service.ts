import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import { WebMcpWsEvent } from '../enums/webmcp.enums';
import type {
  WebMcpDescriptorRequest,
  WebMcpDescriptorResponse,
  WebMcpOperation,
  WebMcpOpResult,
} from '../types/webmcp.types';
import { WebMcpCacheService } from '../cache/webmcp.cache';

/**
 * @title WebMCP 服务
 * @description 负责通过 Socket 网关请求页面描述并下发操作。
 * @keywords-cn WebMCP服务, 描述请求, 操作下发
 * @keywords-en webmcp-service, request-descriptor, dispatch-operations
 */
@Injectable()
export class WebMcpService {
  private readonly logger = new Logger(WebMcpService.name);
  private server?: Server;
  private readonly cache = new WebMcpCacheService();
  private descriptorResolvers: Array<
    (payload: WebMcpDescriptorResponse) => void
  > = [];
  private opResolvers: Array<(result: WebMcpOpResult) => void> = [];

  attachServer(server: Server) {
    this.server = server;
  }

  cacheDescriptor(
    clientId: string,
    page: string,
    descriptor: unknown,
    ts: number,
  ) {
    this.cache.set({ clientId, page, ts, descriptor });
  }

  awaitDescriptor(timeoutMs = 5000): Promise<WebMcpDescriptorResponse | null> {
    return new Promise((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      }, timeoutMs);
      this.descriptorResolvers.push((payload) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  awaitOpResult(timeoutMs = 5000): Promise<WebMcpOpResult> {
    return new Promise((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({ ok: false, error: 'timeout' });
        }
      }, timeoutMs);
      this.opResolvers.push((result) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        resolve(result);
      });
    });
  }

  notifyDescriptor(payload: WebMcpDescriptorResponse) {
    const resolver = this.descriptorResolvers.shift();
    if (resolver) resolver(payload);
  }

  notifyOpResult(result: WebMcpOpResult) {
    const resolver = this.opResolvers.shift();
    if (resolver) resolver(result);
  }

  /**
   * 请求前端页面的 WebMCP 描述，并在首次响应时写入缓存。
   */
  async requestDescriptor(
    req: WebMcpDescriptorRequest,
    timeoutMs = 5000,
  ): Promise<WebMcpDescriptorResponse | null> {
    if (!this.server) {
      this.logger.warn('Socket server is not attached');
      return null;
    }
    const page = req.page;
    this.server.emit(WebMcpWsEvent.Get, { page });
    const resp = await this.awaitDescriptor(timeoutMs);
    if (!resp) return null;
    this.cacheDescriptor('unknown', resp.page, resp.descriptor, resp.ts);
    return { page: resp.page, descriptor: resp.descriptor, ts: resp.ts };
  }

  /**
   * 下发操作到前端并等待结果。
   */
  async dispatchOperation(
    op: WebMcpOperation,
    timeoutMs = 5000,
  ): Promise<WebMcpOpResult> {
    if (!this.server)
      return { ok: false, error: 'Socket server not available' };
    this.server.emit(WebMcpWsEvent.Op, op);
    const result = await this.awaitOpResult(timeoutMs);
    return result;
  }

  listRegisteredPages() {
    return this.cache.listPages();
  }
}
