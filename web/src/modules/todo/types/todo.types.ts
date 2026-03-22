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
  description: string | null;
  content: string | null;
  followerIds: string[] | null;
  statusColor: string | null;
  status: TodoStatus;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface TodoFollowup {
  id: string;
  todoId: string;
  followerId: string;
  followerName: string | null;
  followerAvatar: string | null;
  status: string;
  content: string | null;
  createdAt: string | Date;
  comments: TodoFollowupComment[];
}

export interface TodoFollowupComment {
  id: string;
  followupId: string;
  userId: string;
  userName: string | null;
  userAvatar: string | null;
  content: string;
  createdAt: string | Date;
}

export interface CreateTodoRequest {
  initiatorId: string;
  title: string;
  description?: string;
  content?: string;
  followerIds?: string[];
  statusColor?: string;
  status?: TodoStatus;
}

export interface UpdateTodoRequest {
  title?: string;
  description?: string;
  content?: string;
  followerIds?: string[];
  statusColor?: string;
  status?: TodoStatus;
}

export interface CreateFollowupRequest {
  followerId: string;
  followerName: string;
  followerAvatar?: string;
  status: string;
  content?: string;
}

export interface CreateCommentRequest {
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
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
  description: z.string().optional(),
  content: z.string().optional(),
  followerIds: z.array(z.string()).optional(),
  statusColor: z.string().optional(),
  status: z.string().optional(),
});

export const UpdateTodoRequestSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  content: z.string().optional(),
  followerIds: z.array(z.string()).optional(),
  statusColor: z.string().optional(),
  status: z.string().optional(),
});

export const CreateFollowupRequestSchema = z.object({
  followerId: z.string().min(1),
  followerName: z.string().min(1),
  followerAvatar: z.string().optional(),
  status: z.string().min(1),
  content: z.string().optional(),
});

export const CreateCommentRequestSchema = z.object({
  userId: z.string().min(1),
  userName: z.string().min(1),
  userAvatar: z.string().optional(),
  content: z.string().min(1),
});

export const ListTodoQuerySchema = z.object({
  status: z.string().optional(),
  followerId: z.string().optional(),
  initiatorId: z.string().optional(),
  q: z.string().optional(),
});
