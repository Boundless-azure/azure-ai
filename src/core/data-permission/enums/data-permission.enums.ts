/**
 * @title 数据权限节点执行状态
 * @description 描述数据权限节点在聚合过程中的状态。
 * @keywords-cn 执行状态, 命中, 拒绝, 跳过
 * @keywords-en execution-status, matched, denied, skipped
 */
export enum DataPermissionNodeStatus {
  Matched = 'matched',
  Denied = 'denied',
  Skipped = 'skipped',
}
