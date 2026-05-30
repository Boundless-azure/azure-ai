import { z } from 'zod';

/**
 * @title Task Types
 * @description 任务模块前端类型与 Zod 校验定义。
 * @keywords-cn 任务类型, 任务请求, Zod校验
 * @keywords-en task-types, task-request, zod-schema
 */
export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  assigneeIds: string[] | null;
  milestone: string | null;
  pmId: string | null;
  folderPath: string | null;
  sessionId: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  assigneeIds?: string[];
  milestone?: string;
  pmId?: string;
  folderPath?: string;
  sessionId?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  assigneeIds?: string[] | null;
  milestone?: string | null;
  pmId?: string | null;
  folderPath?: string | null;
  sessionId?: string | null;
}

export interface ListTaskQuery {
  sessionId?: string;
  pmId?: string;
  assigneeId?: string;
  q?: string;
}

export const CreateTaskRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assigneeIds: z.array(z.string()).optional(),
  milestone: z.string().optional(),
  pmId: z.string().optional(),
  folderPath: z.string().optional(),
  sessionId: z.string().optional(),
});

export const UpdateTaskRequestSchema = z.object({
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).nullable().optional(),
  milestone: z.string().nullable().optional(),
  pmId: z.string().nullable().optional(),
  folderPath: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(),
});

export const ListTaskQuerySchema = z.object({
  sessionId: z.string().optional(),
  pmId: z.string().optional(),
  assigneeId: z.string().optional(),
  q: z.string().optional(),
});
