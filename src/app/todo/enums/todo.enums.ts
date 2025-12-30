/**
 * @title 待办事项枚举定义
 * @description 定义待办状态枚举，涵盖未读、已阅、已完成、已拒绝与失败执行。
 * @keywords-cn 待办状态, 枚举
 * @keywords-en todo-status, enum
 */
export enum TodoStatus {
  Unread = 'unread',
  Read = 'read',
  Completed = 'completed',
  Rejected = 'rejected',
  Failed = 'failed',
}
