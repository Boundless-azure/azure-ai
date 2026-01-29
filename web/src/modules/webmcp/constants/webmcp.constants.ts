/**
 * @title WebMCP 常量
 * @description WebMCP 前端 SDK 默认命名空间/Socket 路径与事件名。
 * @keywords-cn 常量, 命名空间, Socket路径
 * @keywords-en constants, namespace, socket-path
 */

export const WEBMCP_NAMESPACE = '/webmcp/ws';
export const WEBMCP_SOCKET_PATH = '/api/socket.io';

export const WEBMCP_EVENT_NAMES = {
  connected: 'webmcp:connected',
  descriptorUpdated: 'webmcp:descriptor-updated',
};

export type WebMcpEventName = keyof typeof WEBMCP_EVENT_NAMES;

