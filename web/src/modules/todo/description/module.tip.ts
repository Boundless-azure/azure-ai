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
      待办入口: 'src/modules/todo/todo.module.ts',
      待办类型: 'src/modules/todo/types/todo.types.ts',
      待办枚举: 'src/modules/todo/enums/todo.enums.ts',
      待办列表: 'src/modules/todo/components/TodoList.vue',
      待办常量: 'src/modules/todo/constants/todo.constants.ts',
      待办hook: 'src/modules/todo/hooks/useTodos.ts',
    },
    en: {
      todo_module_entry: 'src/modules/todo/todo.module.ts',
      todo_types: 'src/modules/todo/types/todo.types.ts',
      todo_enums: 'src/modules/todo/enums/todo.enums.ts',
      todo_list_component: 'src/modules/todo/components/TodoList.vue',
      todo_constants: 'src/modules/todo/constants/todo.constants.ts',
      todo_hook: 'src/modules/todo/hooks/useTodos.ts',
    },
  },
  hashMap: {
    listTodos: 'hash_listTodos_001',
    createTodo: 'hash_createTodo_002',
    updateTodo: 'hash_updateTodo_003',
    deleteTodo: 'hash_deleteTodo_004',
    useTodos_list: 'hash_hook_todo_list_001',
    useTodos_get: 'hash_hook_todo_get_002',
    useTodos_create: 'hash_hook_todo_create_003',
    useTodos_update: 'hash_hook_todo_update_004',
    useTodos_remove: 'hash_hook_todo_remove_005',
  },
};
