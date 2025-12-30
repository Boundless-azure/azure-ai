import { todoApi } from '../../../api/todo';
import type { TodoItem, CreateTodoRequest, UpdateTodoRequest } from '../types/todo.types';
import type { BaseResponse } from '../../../utils/types';
import { useUIStore } from '../../agent/store/ui.store';

/**
 * @title Todo Service
 * @description 前端待办数据访问与错误处理封装。
 * @keywords-cn 待办服务, 数据访问
 * @keywords-en todo-service, data-access
 */
export class TodoService {
  private isBase<T>(resp: unknown): resp is BaseResponse<T> {
    return typeof resp === 'object' && resp !== null && 'data' in (resp as any) && 'code' in (resp as any);
  }

  public getHandle() {
    return { name: 'todo_service', description: 'Manage todo items via REST API', parameters: {} };
  }

  async list(params?: { status?: string; recipientId?: string; pluginId?: string }): Promise<TodoItem[]> {
    try {
      const resp = await todoApi.list(params);
      return this.isBase<TodoItem[]>(resp) ? resp.data : (resp as unknown as TodoItem[]);
    } catch (e: any) {
      useUIStore().showToast(e?.message ?? 'Network error', 'error');
      throw e;
    }
  }

  async create(data: CreateTodoRequest): Promise<TodoItem> {
    try {
      const resp = await todoApi.create(data);
      return this.isBase<TodoItem>(resp) ? resp.data : (resp as unknown as TodoItem);
    } catch (e: any) {
      useUIStore().showToast(e?.message ?? 'Network error', 'error');
      throw e;
    }
  }

  async update(id: string, data: UpdateTodoRequest): Promise<TodoItem> {
    try {
      const resp = await todoApi.update(id, data);
      return this.isBase<TodoItem>(resp) ? resp.data : (resp as unknown as TodoItem);
    } catch (e: any) {
      useUIStore().showToast(e?.message ?? 'Network error', 'error');
      throw e;
    }
  }

  async delete(id: string): Promise<{ ok: boolean }> {
    try {
      const resp = await todoApi.delete(id);
      return this.isBase<{ ok: boolean }>(resp) ? resp.data : (resp as unknown as { ok: boolean });
    } catch (e: any) {
      useUIStore().showToast(e?.message ?? 'Network error', 'error');
      throw e;
    }
  }
}

export const todoService = new TodoService();

