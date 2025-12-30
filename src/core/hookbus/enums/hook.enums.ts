/**
 * @title Hook 枚举
 * @description 定义 Hook 执行状态与阶段等枚举。
 * @keywords-cn Hook状态, Hook阶段, 枚举
 * @keywords-en hook-status, hook-phase, enum
 */
export enum HookResultStatus {
  Success = 'success',
  Error = 'error',
  Skipped = 'skipped',
}

export enum HookPhase {
  Before = 'before',
  After = 'after',
  Around = 'around',
}
