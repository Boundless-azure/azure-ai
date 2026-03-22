/**
 * @title Todo API
 * @description API endpoints for the Todo module including followups and comments.
 * @keywords-cn 待办API, 接口定义, 跟进, 评论
 * @keywords-en todo-api, endpoints, followup, comment
 */
import { http } from '../utils/http';
import type {
  TodoItem,
  CreateTodoRequest,
  UpdateTodoRequest,
  TodoFollowup,
  CreateFollowupRequest,
  TodoFollowupComment,
  CreateCommentRequest,
  UpdateFollowupRequest,
} from '../modules/todo/types/todo.types';
import {
  CreateTodoRequestSchema,
  UpdateTodoRequestSchema,
  ListTodoQuerySchema,
  CreateFollowupRequestSchema,
  CreateCommentRequestSchema,
  UpdateFollowupRequestSchema,
} from '../modules/todo/types/todo.types';

export const todoApi = {
  // 待办列表
  list: (params?: { status?: string; followerId?: string; initiatorId?: string; q?: string }) => {
    const parsed = params ? ListTodoQuerySchema.safeParse(params) : { success: true, data: {} };
    if (!parsed.success) throw new Error('Invalid todo list query');
    return http.get<TodoItem[]>('/todo', parsed.data);
  },

  // 获取待办详情
  get: (id: string) => http.get<TodoItem>(`/todo/${id}`),

  // 创建待办
  create: (data: CreateTodoRequest) => {
    const parsed = CreateTodoRequestSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid create todo payload');
    return http.post<TodoItem>('/todo', parsed.data);
  },

  // 更新待办
  update: (id: string, data: UpdateTodoRequest) => {
    const parsed = UpdateTodoRequestSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid update todo payload');
    return http.put<TodoItem>(`/todo/${id}`, parsed.data);
  },

  // 删除待办
  delete: (id: string) => http.delete<{ ok: boolean }>(`/todo/${id}`),

  // ==================== 跟进记录 ====================

  // 创建跟进记录
  createFollowup: (todoId: string, data: CreateFollowupRequest) => {
    const parsed = CreateFollowupRequestSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid create followup payload');
    return http.post<TodoFollowup>(`/todo/${todoId}/followups`, parsed.data);
  },

  // 获取待办的跟进记录列表
  listFollowups: (todoId: string) => http.get<TodoFollowup[]>(`/todo/${todoId}/followups`),

  // 删除跟进记录
  deleteFollowup: (followupId: string) => http.delete<{ ok: boolean }>(`/todo/followups/${followupId}`),

  // 更新跟进记录
  updateFollowup: (followupId: string, data: UpdateFollowupRequest) => {
    const parsed = UpdateFollowupRequestSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid update followup payload');
    return http.put<TodoFollowup>(`/todo/followups/${followupId}`, parsed.data);
  },

  // ==================== 评论 ====================

  // 创建评论
  createComment: (followupId: string, data: CreateCommentRequest) => {
    const parsed = CreateCommentRequestSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid create comment payload');
    return http.post<TodoFollowupComment>(`/todo/followups/${followupId}/comments`, parsed.data);
  },

  // 获取跟进记录的评论列表
  listComments: (followupId: string) => http.get<TodoFollowupComment[]>(`/todo/followups/${followupId}/comments`),

  // 删除评论
  deleteComment: (commentId: string) => http.delete<{ ok: boolean }>(`/todo/comments/${commentId}`),
};
