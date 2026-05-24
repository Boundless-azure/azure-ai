/**
 * @title useAgentCheckpoints
 * @description 会话检查点列表与详情的组合函数，供组件与其他 hooks 互调。
 * @keywords-cn 检查点, 列表, 详情
 * @keywords-en checkpoints, list, detail
 */
import { ref } from 'vue';
import { agentApi } from '../../../api/agent';
import type { BaseResponse } from '../../../utils/types';
import type { Checkpoint, CheckpointListResponse } from '../types/agent.types';

export function useAgentCheckpoints() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function list(threadId: string, limit: number = 50) {
    loading.value = true;
    error.value = null;
    try {
      const res: BaseResponse<CheckpointListResponse> =
        await agentApi.listCheckpoints(threadId, limit);
      return res.data;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'list checkpoints failed';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function getDetail(threadId: string, checkpointId: string) {
    const res: BaseResponse<Checkpoint> = await agentApi.getCheckpointDetail(
      threadId,
      checkpointId,
    );
    return res.data;
  }

  return { loading, error, list, getDetail };
}
