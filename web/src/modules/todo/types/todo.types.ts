import type { TodoStatus } from '../enums/todo.enums';

/**
 * @title Todo 类型
 * @description 前端待办项与请求类型定义。
 * @keywords-cn 待办类型, 请求类型
 * @keywords-en todo-types, request-types
 */
export interface TodoItem {
  id: string;
  initiatorId: string;
  title: string;
  pluginId: string | null;
  description: string | null;
  action: Record<string, unknown> | null;
  recipientId: string;
  status: TodoStatus;
  receipt: Record<string, unknown> | null;
  createdAt?: string | Date;
}

export interface CreateTodoRequest {
  initiatorId: string;
  title: string;
  pluginId?: string;
  description?: string;
  action?: Record<string, unknown>;
  recipientId: string;
  status?: TodoStatus;
}

export interface UpdateTodoRequest {
  status?: TodoStatus;
  description?: string;
  action?: Record<string, unknown>;
  receipt?: Record<string, unknown>;
}

