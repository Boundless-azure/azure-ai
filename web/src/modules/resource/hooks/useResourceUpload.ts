/**
 * @title useResourceUpload
 * @description 统一资源上传 hook：支持进度回调、资源ID/路径返回，遵循异步原则。
 * @keywords-cn 资源上传hook, 进度, 异步, 资源ID
 * @keywords-en resource-upload-hook, progress, async, resource-id
 */

import { ref } from 'vue';
import { resourceApi } from '../../../api/resource';
import type { UploadResourceResponse } from '../types/resource.types';

export function useResourceUpload() {
  const uploading = ref(false);
  const progress = ref({ loaded: 0, total: 0, percent: 0 });
  const result = ref<UploadResourceResponse | null>(null);
  const error = ref<string | null>(null);

  async function upload(file: File, opts?: { signal?: AbortSignal }) {
    uploading.value = true;
    error.value = null;
    result.value = null;
    progress.value = { loaded: 0, total: file.size || 0, percent: 0 };
    try {
      const res = await resourceApi.upload(file, {
        signal: opts?.signal,
        onProgress: (p) => {
          progress.value = p;
        },
      });
      result.value = res.data;
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      error.value = msg;
      throw e;
    } finally {
      uploading.value = false;
    }
  }

  return { uploading, progress, result, error, upload };
}
