import type {
  WebMcpDescriptorResponse,
  WebMcpOperation,
  WebMcpOpResult,
} from '../types/webmcp.types';
import { WebMcpService } from './webmcp.service';

/**
 * @title WebMCP Server SDK
 * @description 服务器侧 SDK：封装获取页面声明与下发操作的能力。
 * @keywords-cn WebMCP服务端SDK, 页面声明, 操作下发
 * @keywords-en webmcp-server-sdk, page-descriptor, dispatch-operation
 */
export function createWebMcpServerSDK(service: WebMcpService) {
  return {
    async getDescriptor(
      page?: string,
    ): Promise<WebMcpDescriptorResponse | null> {
      return service.requestDescriptor({ page });
    },
    async dispatch(
      op: WebMcpOperation,
      timeoutMs = 5000,
    ): Promise<WebMcpOpResult> {
      return service.dispatchOperation(op, timeoutMs);
    },
    listPages(): Array<{ page: string; clientId: string; ts: number }> {
      return service.listRegisteredPages();
    },
  };
}
