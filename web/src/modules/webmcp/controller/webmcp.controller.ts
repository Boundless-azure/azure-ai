/**
 * @title WebMCP Controller (Web)
 * @description Facade for pages to register declaration and connect client.
 * @keywords-cn WebMCP控制器, 页面注册, 客户端连接
 * @keywords-en webmcp-controller, page-register, client-connect
 */
import { WebMcpRegistryService } from '../services/webmcp.registry.service';
import { WebMcpClientService } from '../services/webmcp.client.service';
import type { WebMcpPageDeclaration } from '../types/webmcp.types';

export function createWebMcpController() {
  const registry = new WebMcpRegistryService();
  const client = new WebMcpClientService(registry);

  return {
    registerPage(decl: WebMcpPageDeclaration) {
      registry.registerPage(decl);
    },
    connect(baseUrl: string) {
      client.connect(baseUrl);
    },
    on: registry.on.bind(registry),
    registerCurrentPage: client.registerCurrentPage.bind(client),
  };
}
