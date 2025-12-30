/**
 * @title Todo Module Tip
 * @description Description and mapping for the Todo module.
 * @keywords-cn 模块描述, 关键词映射, 待办
 * @keywords-en module-description, keyword-mapping, todo
 */

export const moduleTip = {
  description:
    'The Todo module provides a unified list view and CRUD operations for pending tasks with plugin linkage.',
  keywords: {
    cn: {
      待办服务: 'services/todo.service.ts',
      待办类型: 'types/todo.types.ts',
      待办枚举: 'enums/todo.enums.ts',
      待办列表: 'components/TodoList.vue',
    },
    en: {
      todo_service: 'services/todo.service.ts',
      todo_types: 'types/todo.types.ts',
      todo_enums: 'enums/todo.enums.ts',
      todo_list_component: 'components/TodoList.vue',
    },
  },
  hashMap: {
    listTodos: 'hash_listTodos_001',
    createTodo: 'hash_createTodo_002',
    updateTodo: 'hash_updateTodo_003',
    deleteTodo: 'hash_deleteTodo_004',
  },
};

