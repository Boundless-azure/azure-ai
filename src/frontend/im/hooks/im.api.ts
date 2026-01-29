/**
 * @title IM 前端 API 组合函数
 * @description 针对 Socket.io 客户端的 IM 事件封装（不直接依赖 socket.io-client）。
 * @keywords-cn IM前端API, 事件封装, join-room, typing, read
 * @keywords-en im-frontend-api, event-wrappers, join-room, typing, read
 */
import { IM_EVENTS } from '../constants';

export interface EmitSocket {
  emit(event: string, ...args: unknown[]): unknown;
  on?(event: string, listener: (...args: unknown[]) => void): unknown;
}

/** 加入会话房间 */
export function joinSession(socket: EmitSocket, sessionId: string): void {
  socket.emit(IM_EVENTS.joinRoom, { sessionId });
}

/** 离开会话房间 */
export function leaveSession(socket: EmitSocket, sessionId: string): void {
  socket.emit(IM_EVENTS.leaveRoom, { sessionId });
}

/** 加入个人通知房间（principalId 可选，省略则使用后端认证主体） */
export function joinNotify(socket: EmitSocket, principalId?: string): void {
  const payload = principalId ? { principalId } : {};
  socket.emit(IM_EVENTS.joinNotify, payload);
}

/** 离开个人通知房间 */
export function leaveNotify(socket: EmitSocket): void {
  socket.emit(IM_EVENTS.leaveNotify);
}

/** 发送输入状态 */
export function emitTyping(
  socket: EmitSocket,
  sessionId: string,
  isTyping: boolean,
): void {
  socket.emit(IM_EVENTS.typing, { sessionId, isTyping });
}

/** 发送已读回执 */
export function emitRead(
  socket: EmitSocket,
  sessionId: string,
  messageId: string,
): void {
  socket.emit(IM_EVENTS.read, { sessionId, messageId });
}

/** 监听统一事件流（im:event） */
export function onImEvent(
  socket: EmitSocket,
  listener: (event: unknown) => void,
): void {
  socket.on?.(IM_EVENTS.event, listener);
}
