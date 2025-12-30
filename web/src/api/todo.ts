/**
 * @title Todo API
 * @description API endpoints for the Todo module.
 * @keywords-cn 待办API, 接口定义
 * @keywords-en todo-api, endpoints
 */
import { http } from '../utils/http';
import type { TodoItem, CreateTodoRequest, UpdateTodoRequest } from '../modules/todo/types/todo.types';

export const todoApi = {
  list: (params?: { status?: string; recipientId?: string; pluginId?: string }) =>
    http.get<TodoItem[]>('/todo', params),
  get: (id: string) => http.get<TodoItem>(`/todo/${id}`),
  create: (data: CreateTodoRequest) => http.post<TodoItem>('/todo', data),
  update: (id: string, data: UpdateTodoRequest) => http.put<TodoItem>(`/todo/${id}`, data),
  delete: (id: string) => http.delete<{ ok: boolean }>(`/todo/${id}`),
};

