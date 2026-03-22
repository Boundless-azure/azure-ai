/**
 * @title useTodos
 * @description 待办列表/获取/创建/更新/删除以及跟进记录和评论管理的组合函数。
 * @keywords-cn 待办, 列表, 创建, 更新, 删除, 跟进, 评论
 * @keywords-en todos, list, create, update, delete, followup, comment
 */
import { ref } from 'vue';
import { todoApi } from '../../../api/todo';
import type {
  TodoItem,
  CreateTodoRequest,
  UpdateTodoRequest,
  TodoFollowup,
  CreateFollowupRequest,
  TodoFollowupComment,
  CreateCommentRequest,
  UpdateFollowupRequest,
} from '../types/todo.types';
import { TODO_EVENT_NAMES } from '../constants/todo.constants';

export function useTodos() {
  const loading = ref(false);
  const items = ref<TodoItem[]>([]);
  const current = ref<TodoItem | null>(null);
  const error = ref<string | null>(null);

  // 待办列表
  async function list(params?: { status?: string; followerId?: string; initiatorId?: string; q?: string }) {
    loading.value = true;
    error.value = null;
    try {
      const res = await todoApi.list(params);
      items.value = Array.isArray(res) ? res : (res as any).data;
      window.dispatchEvent(new CustomEvent(TODO_EVENT_NAMES.listChanged));
      return items.value;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'list todos failed';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  // 获取待办详情
  async function get(id: string) {
    const res = await todoApi.get(id);
    current.value = (res as any).data ?? res;
    return current.value;
  }

  // 创建待办
  async function create(data: CreateTodoRequest) {
    const res = await todoApi.create(data);
    window.dispatchEvent(new CustomEvent(TODO_EVENT_NAMES.listChanged));
    return res;
  }

  // 更新待办
  async function update(id: string, data: UpdateTodoRequest) {
    const res = await todoApi.update(id, data);
    window.dispatchEvent(new CustomEvent(TODO_EVENT_NAMES.itemUpdated));
    return res;
  }

  // 删除待办
  async function remove(id: string) {
    const res = await todoApi.delete(id);
    window.dispatchEvent(new CustomEvent(TODO_EVENT_NAMES.listChanged));
    return res;
  }

  // ==================== 跟进记录 ====================

  const followupsLoading = ref(false);
  const followups = ref<TodoFollowup[]>([]);

  // 创建跟进记录
  async function createFollowup(todoId: string, data: CreateFollowupRequest) {
    const res = await todoApi.createFollowup(todoId, data);
    await listFollowups(todoId);
    return res;
  }

  // 获取待办的跟进记录
  async function listFollowups(todoId: string) {
    followupsLoading.value = true;
    try {
      const res = await todoApi.listFollowups(todoId);
      followups.value = Array.isArray(res) ? res : (res as any).data;
      return followups.value;
    } finally {
      followupsLoading.value = false;
    }
  }

  // 删除跟进记录
  async function removeFollowup(followupId: string) {
    const res = await todoApi.deleteFollowup(followupId);
    return res;
  }

  // 更新跟进记录
  async function updateFollowup(followupId: string, data: UpdateFollowupRequest, todoId: string) {
    const res = await todoApi.updateFollowup(followupId, data);
    await listFollowups(todoId);
    return res;
  }

  // ==================== 评论 ====================

  const commentsLoading = ref(false);
  const comments = ref<TodoFollowupComment[]>([]);

  // 创建评论
  async function createComment(followupId: string, data: CreateCommentRequest) {
    const res = await todoApi.createComment(followupId, data);
    await listComments(followupId);
    return res;
  }

  // 获取跟进记录的评论
  async function listComments(followupId: string) {
    commentsLoading.value = true;
    try {
      const res = await todoApi.listComments(followupId);
      comments.value = Array.isArray(res) ? res : (res as any).data;
      return comments.value;
    } finally {
      commentsLoading.value = false;
    }
  }

  // 删除评论
  async function removeComment(commentId: string) {
    const res = await todoApi.deleteComment(commentId);
    return res;
  }

  return {
    loading,
    items,
    current,
    error,
    followupsLoading,
    followups,
    commentsLoading,
    comments,
    list,
    get,
    create,
    update,
    remove,
    createFollowup,
    listFollowups,
    removeFollowup,
    updateFollowup,
    createComment,
    listComments,
    removeComment,
  };
}
