/**
 * @title IM 前端常量
 * @description 提供 IM namespace 与事件名常量。
 * @keywords-cn IM常量, 命名空间, 事件名
 * @keywords-en im-constants, namespace, event-names
 */
export const IM_NAMESPACE = '/im';

export const IM_EVENTS = {
  joinRoom: 'user-room/join-room',
  leaveRoom: 'user-room/leave-room',
  joinNotify: 'user-room/join-notify',
  leaveNotify: 'user-room/leave-notify',
  typing: 'im:typing',
  read: 'im:read',
  event: 'im:event',
  userNewMessage: 'user-room/new_message',
} as const;

export type ImEventName = keyof typeof IM_EVENTS;
