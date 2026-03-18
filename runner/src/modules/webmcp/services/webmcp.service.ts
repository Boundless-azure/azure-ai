import type { WebMcpDescriptor, WebMcpOperation } from '../types/webmcp.types';

/**
 * @title WebMCP 服务
 * @description 提供 runner 侧页面描述缓存和操作分发记录能力。
 * @keywords-cn WebMCP服务, 描述缓存, 操作分发
 * @keywords-en webmcp-service, descriptor-cache, operation-dispatch
 */
export class RunnerWebMcpService {
  private readonly descriptorMap = new Map<string, WebMcpDescriptor>();
  private readonly operationHistory: WebMcpOperation[] = [];

  registerDescriptor(payload: WebMcpDescriptor): void {
    this.descriptorMap.set(payload.page, payload);
  }

  getDescriptor(page: string): WebMcpDescriptor | null {
    return this.descriptorMap.get(page) ?? null;
  }

  listPages(): string[] {
    return Array.from(this.descriptorMap.keys());
  }

  dispatchOperation(operation: WebMcpOperation): { ok: boolean; ts: number } {
    this.operationHistory.push(operation);
    return { ok: true, ts: Date.now() };
  }
}
