/**
 * @title Task 模块入口
 * @description 导出任务 hooks 与类型定义。
 * @keywords-cn 任务模块入口, 任务导出
 * @keywords-en task-module-entry, task-export
 */
import { useTasks } from './hooks/useTasks';

export * from './types/task.types';

export const TaskModule = {
  name: 'TaskModule',
  hooks: { useTasks },
};
