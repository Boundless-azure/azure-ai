/**
 * @title IM 前端模块
 * @description 导出 IM 前端常量、连接选项构造与事件封装函数。
 * @keywords-cn IM前端模块, 常量, 连接选项, 事件封装
 * @keywords-en im-frontend-module, constants, connection-options, event-wrappers
 */
export { IM_NAMESPACE, IM_EVENTS } from './constants';
export {
  buildImConnectionOptions,
  buildImNamespaceUrl,
  type SocketConnectOptions,
  type ClientSocket,
  type SocketFactory,
  createImSocket,
  setAuthAndConnect,
} from './hooks/connection';
export {
  joinSession,
  leaveSession,
  joinNotify,
  leaveNotify,
  emitTyping,
  emitRead,
  onImEvent,
  type EmitSocket,
} from './hooks/im.api';
