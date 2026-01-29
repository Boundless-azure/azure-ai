/**
 * @title Todo 常量
 * @description 待办模块的事件名与默认配置。
 * @keywords-cn 待办常量, 事件, 配置
 * @keywords-en todo-constants, events, config
 */

export const TODO_EVENT_NAMES = {
  listChanged: 'todo:list-changed',
  itemUpdated: 'todo:item-updated',
};

export const TODO_DEFAULTS = {
  pageSize: 50,
};

export type TodoEventName = keyof typeof TODO_EVENT_NAMES;

