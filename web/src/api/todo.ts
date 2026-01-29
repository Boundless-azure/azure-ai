/**
 * @title Todo API
 * @description API endpoints for the Todo module.
 * @keywords-cn 待办API, 接口定义
 * @keywords-en todo-api, endpoints
 */
import { http } from '../utils/http';
import type { TodoItem, CreateTodoRequest, UpdateTodoRequest } from '../modules/todo/types/todo.types';
import { CreateTodoRequestSchema, UpdateTodoRequestSchema, ListTodoQuerySchema } from '../modules/todo/types/todo.types';

export const todoApi = {
  list: (params?: { status?: string; recipientId?: string; pluginId?: string }) => {
    const parsed = params ? ListTodoQuerySchema.safeParse(params) : { success: true, data: {} };
    if (!parsed.success) throw new Error('Invalid todo list query');
    return http.get<TodoItem[]>('/todo', parsed.data);
  },
  get: (id: string) => http.get<TodoItem>(`/todo/${id}`),
  create: (data: CreateTodoRequest) => {
    const parsed = CreateTodoRequestSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid create todo payload');
    return http.post<TodoItem>('/todo', parsed.data);
  },
  update: (id: string, data: UpdateTodoRequest) => {
    const parsed = UpdateTodoRequestSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid update todo payload');
    return http.put<TodoItem>(`/todo/${id}`, parsed.data);
  },
  delete: (id: string) => http.delete<{ ok: boolean }>(`/todo/${id}`),
};
