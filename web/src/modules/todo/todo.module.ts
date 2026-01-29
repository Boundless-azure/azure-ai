/**
 * @title Todo 模块入口
 * @description 导出待办 hooks、常量与服务，供外部统一引用。
 * @keywords-cn 模块入口, 待办, 导出
 * @keywords-en module-entry, todo, exports
 */
import * as TodoConstants from './constants/todo.constants';
import { useTodos } from './hooks/useTodos';
import { moduleTip } from './description/module.tip';
export * from './types/todo.types';
export * from './enums/todo.enums';

export const TodoModule = {
  name: 'TodoModule',
  constants: TodoConstants,
  hooks: { useTodos },
  tip: moduleTip,
};
