/**
 * @title useTasks
 * @description 任务列表、详情与 CRUD 组合函数。
 * @keywords-cn 任务Hook, 列表, 创建, 更新, 删除
 * @keywords-en use-tasks, list, create, update, delete
 */
import { ref } from 'vue';
import { taskApi } from '../../../api/task';
import type {
  CreateTaskRequest,
  ListTaskQuery,
  TaskItem,
  UpdateTaskRequest,
} from '../types/task.types';

export function useTasks() {
  const loading = ref(false);
  const items = ref<TaskItem[]>([]);
  const current = ref<TaskItem | null>(null);
  const error = ref<string | null>(null);

  /**
   * 获取任务列表。
   * @keyword-en use-tasks-list
   */
  async function list(params?: ListTaskQuery) {
    loading.value = true;
    error.value = null;
    try {
      const res = await taskApi.list(params);
      items.value = Array.isArray(res) ? res : (res as any).data;
      return items.value;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'list tasks failed';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取任务详情。
   * @keyword-en use-tasks-get
   */
  async function get(id: string) {
    const res = await taskApi.get(id);
    current.value = (res as any).data ?? res;
    return current.value;
  }

  /**
   * 创建任务。
   * @keyword-en use-tasks-create
   */
  async function create(data: CreateTaskRequest) {
    return await taskApi.create(data);
  }

  /**
   * 更新任务。
   * @keyword-en use-tasks-update
   */
  async function update(id: string, data: UpdateTaskRequest) {
    return await taskApi.update(id, data);
  }

  /**
   * 删除任务。
   * @keyword-en use-tasks-delete
   */
  async function remove(id: string) {
    return await taskApi.delete(id);
  }

  return {
    loading,
    items,
    current,
    error,
    list,
    get,
    create,
    update,
    remove,
  };
}
