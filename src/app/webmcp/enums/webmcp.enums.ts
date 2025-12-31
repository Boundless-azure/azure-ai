/**
 * @title WebMCP Enums
 * @description Event names and constants for WebMCP Socket protocol.
 * @keywords-cn WebMCP枚举, 事件名, 常量
 * @keywords-en webmcp-enums, event-names, constants
 */

export enum WebMcpWsEvent {
  Register = 'webmcp/register',
  Get = 'webmcp/get',
  Descriptor = 'webmcp/descriptor',
  Op = 'webmcp/op',
  OpResult = 'webmcp/op_result',
}

export const WEBMCP_NAMESPACE = '/webmcp/ws';
export const WEBMCP_SOCKET_PATH = '/api/socket.io';
