import type { TodoStatus } from '../enums/todo.enums';
import { z } from 'zod';

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

/**
 * @title Todo Zod Schemas
 * @description 前端待办请求的 Zod 参数校验。
 * @keywords-cn 待办校验, Zod
 * @keywords-en todo-schemas, zod
 */
export const CreateTodoRequestSchema = z.object({
  initiatorId: z.string().min(1),
  title: z.string().min(1),
  pluginId: z.string().optional(),
  description: z.string().optional(),
  action: z.record(z.any()).optional(),
  recipientId: z.string().min(1),
  status: z.string().optional(),
});

export const UpdateTodoRequestSchema = z.object({
  status: z.string().optional(),
  description: z.string().optional(),
  action: z.record(z.any()).optional(),
  receipt: z.record(z.any()).optional(),
});

export const ListTodoQuerySchema = z.object({
  status: z.string().optional(),
  recipientId: z.string().optional(),
  pluginId: z.string().optional(),
});
