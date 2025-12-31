/**
 * @title WebMCP Cache Service
 * @description In-memory store for page descriptors and client mappings.
 * @keywords-cn WebMCP缓存, 描述缓存, 客户端映射
 * @keywords-en webmcp-cache, descriptor-store, client-mapping
 */

export interface ClientDescriptor {
  clientId: string;
  page: string;
  ts: number;
  descriptor: unknown;
}

export class WebMcpCacheService {
  private byClient = new Map<string, ClientDescriptor>();
  private byPage = new Map<string, ClientDescriptor>();

  set(desc: ClientDescriptor) {
    this.byClient.set(desc.clientId, desc);
    this.byPage.set(desc.page, desc);
  }

  getByClient(clientId: string): ClientDescriptor | undefined {
    return this.byClient.get(clientId);
  }

  getByPage(page: string): ClientDescriptor | undefined {
    return this.byPage.get(page);
  }

  listPages(): Array<{ page: string; clientId: string; ts: number }> {
    return Array.from(this.byPage.values()).map(({ page, clientId, ts }) => ({
      page,
      clientId,
      ts,
    }));
  }
}
