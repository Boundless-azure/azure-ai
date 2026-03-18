/**
 * @title Runner Constants
 * @description Runner 模块常量定义。
 * @keywords-cn Runner常量, 状态文案, 事件名
 * @keywords-en runner-constants, status-label, event-name
 */
export const RUNNER_STATUS_LABEL: Record<'mounted' | 'offline', string> = {
  mounted: '挂载中',
  offline: '离线中',
};

export const RUNNER_EVENT_NAMES = {
  created: 'runner:created',
  updated: 'runner:updated',
  deleted: 'runner:deleted',
} as const;
