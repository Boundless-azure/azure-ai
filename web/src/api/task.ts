/**
 * @title Task API
 * @description Task module API endpoints.
 * @keywords-cn 任务API, 任务接口
 * @keywords-en task-api, task-endpoints
 */
import { http } from '../utils/http';
import type {
  CreateTaskRequest,
  ListTaskQuery,
  TaskItem,
  UpdateTaskRequest,
} from '../modules/task/types/task.types';
import {
  CreateTaskRequestSchema,
  ListTaskQuerySchema,
  UpdateTaskRequestSchema,
} from '../modules/task/types/task.types';

export const taskApi = {
  /**
   * 查询任务列表。
   * @keyword-en list-tasks
   */
  list: (params?: ListTaskQuery) => {
    const parsed = params
      ? ListTaskQuerySchema.safeParse(params)
      : { success: true, data: {} };
    if (!parsed.success) throw new Error('Invalid task list query');
    return http.get<TaskItem[]>('/task', parsed.data);
  },

  /**
   * 获取任务详情。
   * @keyword-en get-task
   */
  get: (id: string) => http.get<TaskItem>(`/task/${id}`),

  /**
   * 创建任务。
   * @keyword-en create-task
   */
  create: (data: CreateTaskRequest) => {
    const parsed = CreateTaskRequestSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid create task payload');
    return http.post<TaskItem>('/task', parsed.data);
  },

  /**
   * 更新任务。
   * @keyword-en update-task
   */
  update: (id: string, data: UpdateTaskRequest) => {
    const parsed = UpdateTaskRequestSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid update task payload');
    return http.put<TaskItem>(`/task/${id}`, parsed.data);
  },

  /**
   * 删除任务。
   * @keyword-en delete-task
   */
  delete: (id: string) => http.delete<{ ok: boolean }>(`/task/${id}`),
};
