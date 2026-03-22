/**
 * @title Solution Constants
 * @description Solution module constants
 * @keywords-cn Solution常量, Solution管理常量
 * @keywords-en solution-constants, solution-management-constants
 */

export const SOLUTION_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export const SOLUTION_STATUS_LABEL = {
  [SOLUTION_STATUS.ACTIVE]: '已启用',
  [SOLUTION_STATUS.INACTIVE]: '已禁用',
} as const;

export const SOLUTION_SOURCE = {
  SELF_DEVELOPED: 'self_developed',
  MARKETPLACE: 'marketplace',
} as const;

export const SOLUTION_SOURCE_LABEL = {
  [SOLUTION_SOURCE.SELF_DEVELOPED]: '自产开发',
  [SOLUTION_SOURCE.MARKETPLACE]: '市场插件',
} as const;

export const SOLUTION_INCLUDE = {
  APP: 'app',
  UNIT: 'unit',
  WORKFLOW: 'workflow',
  AGENT: 'agent',
} as const;

export const SOLUTION_INCLUDE_LABEL = {
  [SOLUTION_INCLUDE.APP]: '应用',
  [SOLUTION_INCLUDE.UNIT]: '单元',
  [SOLUTION_INCLUDE.WORKFLOW]: '工作流',
  [SOLUTION_INCLUDE.AGENT]: '智能体',
} as const;

export const DEFAULT_SOLUTION_ICON = 'fa-solid fa-box-open';
