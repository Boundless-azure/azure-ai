/**
 * @title 待办事项枚举定义
 * @description 定义待办状态枚举，涵盖未开始、进行中、失败、等待验收、已完成等状态。
 * @keywords-cn 待办状态, 枚举
 * @keywords-en todo-status, enum
 */
export enum TodoStatus {
  /** 未开始 */
  Pending = 'pending',
  /** 进行中 */
  InProgress = 'in_progress',
  /** 失败 */
  Failed = 'failed',
  /** 等待验收 */
  WaitingAcceptance = 'waiting_acceptance',
  /** 已完成 */
  Completed = 'completed',
}
