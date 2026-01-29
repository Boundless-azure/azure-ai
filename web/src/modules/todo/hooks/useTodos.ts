/**
 * @title useTodos
 * @description 待办列表/获取/创建/更新/删除的组合函数，便于与其他模块互调。
 * @keywords-cn 待办, 列表, 创建, 更新, 删除
 * @keywords-en todos, list, create, update, delete
 */
import { ref } from 'vue';
import { todoApi } from '../../../api/todo';
import type { TodoItem, CreateTodoRequest, UpdateTodoRequest } from '../types/todo.types';
import { TODO_EVENT_NAMES } from '../constants/todo.constants';

export function useTodos() {
  const loading = ref(false);
  const items = ref<TodoItem[]>([]);
  const current = ref<TodoItem | null>(null);
  const error = ref<string | null>(null);

  async function list(params?: { status?: string; recipientId?: string; pluginId?: string }) {
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

  async function get(id: string) {
    const res = await todoApi.get(id);
    current.value = (res as any).data ?? res;
    return current.value;
  }

  async function create(data: CreateTodoRequest) {
    const res = await todoApi.create(data);
    window.dispatchEvent(new CustomEvent(TODO_EVENT_NAMES.listChanged));
    return res;
  }

  async function update(id: string, data: UpdateTodoRequest) {
    const res = await todoApi.update(id, data);
    window.dispatchEvent(new CustomEvent(TODO_EVENT_NAMES.itemUpdated));
    return res;
  }

  async function remove(id: string) {
    const res = await todoApi.delete(id);
    window.dispatchEvent(new CustomEvent(TODO_EVENT_NAMES.listChanged));
    return res;
  }

  return { loading, items, current, error, list, get, create, update, remove };
}

