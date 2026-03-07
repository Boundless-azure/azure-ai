/**
 * @title useAiProviders
 * @description AI提供商模型配置的列表与维护组合函数。
 * @keywords-cn AI提供商, 模型管理, 列表, 更新
 * @keywords-en ai-providers, model-management, list, update
 */
import { ref } from 'vue';
import { agentApi } from '../../../api/agent';
import type {
  AiModelItem,
  TestAiModelConnectionRequest,
} from '../types/ai-provider.types';

export function useAiProviders() {
  const items = ref<AiModelItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function list(params?: {
    q?: string;
    provider?: string;
    type?: string;
    status?: string;
    enabled?: boolean;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const res = await agentApi.listAiModels(params);
      items.value = res.data;
      return res.data;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'list failed';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function create(payload: {
    name: string;
    displayName?: string | null;
    provider: string;
    apiProtocol?: string;
    type: string;
    status?: string;
    apiKey: string;
    baseURL?: string | null;
    description?: string | null;
    enabled?: boolean;
  }) {
    const res = await agentApi.createAiModel(payload);
    return res.data;
  }

  async function update(
    id: string,
    payload: {
      name?: string;
      displayName?: string | null;
      provider?: string;
      apiProtocol?: string;
      type?: string;
      status?: string;
      apiKey?: string;
      baseURL?: string | null;
      description?: string | null;
      enabled?: boolean;
    },
  ) {
    const res = await agentApi.updateAiModel(id, payload);
    return res.data;
  }

  async function remove(id: string) {
    const res = await agentApi.deleteAiModel(id);
    return res.data;
  }

  async function testConnection(payload: TestAiModelConnectionRequest) {
    const res = await agentApi.testAiModelConnection(payload);
    return res.data;
  }

  return {
    items,
    loading,
    error,
    list,
    create,
    update,
    remove,
    testConnection,
  };
}
