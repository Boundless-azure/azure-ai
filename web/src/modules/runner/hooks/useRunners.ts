/**
 * @title useRunners
 * @description Runner 列表与增删改查组合函数。
 * @keywords-cn Runner, 列表, 新增, 更新, 删除
 * @keywords-en runners, list, create, update, delete
 */
import { ref } from 'vue';
import { runnerApi } from '../../../api/runner';
import type {
  CreateRunnerRequest,
  CreateRunnerResult,
  RunnerItem,
  UpdateRunnerRequest,
} from '../types/runner.types';

export function useRunners() {
  const items = ref<RunnerItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const latestCreatedKey = ref<string | null>(null);

  async function list(params?: { q?: string; status?: string; principalId?: string }) {
    loading.value = true;
    error.value = null;
    try {
      const res = await runnerApi.list(params);
      items.value = res.data;
      return res.data;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'list runners failed';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function create(data: CreateRunnerRequest): Promise<CreateRunnerResult> {
    const res = await runnerApi.create(data);
    latestCreatedKey.value = res.data.runnerKey;
    // 持久化 runnerKey 到 localStorage
    if (res.data.runnerKey && res.data.runnerKey !== '-') {
      localStorage.setItem(`runner_key_${res.data.id}`, res.data.runnerKey);
    }
    await list();
    return res.data;
  }

  async function update(id: string, data: UpdateRunnerRequest): Promise<RunnerItem> {
    const res = await runnerApi.update(id, data);
    await list();
    return res.data;
  }

  async function remove(id: string): Promise<void> {
    await runnerApi.delete(id);
    await list();
  }

  return {
    items,
    loading,
    error,
    latestCreatedKey,
    list,
    create,
    update,
    remove,
  };
}
