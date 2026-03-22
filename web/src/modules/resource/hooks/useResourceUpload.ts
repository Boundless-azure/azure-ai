/**
 * @title useResourceUpload
 * @description 统一资源上传 hook：支持单文件、多文件、拖拽上传、分片上传、断点续传
 * @keywords-cn 资源上传hook, 拖拽, 多文件, 分片, 断点续传
 * @keywords-en resource-upload-hook, drag-drop, multi-file, chunked, resume
 */
import { ref, shallowRef } from 'vue';
import { resourceApi } from '../../../api/resource';
import type { UploadResourceResponse } from '../types/resource.types';

export interface UploadItem {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  result?: UploadResourceResponse;
  error?: string;
  abortController?: AbortController;
}

export function useResourceUpload() {
  const uploading = ref(false);
  const progress = ref({ loaded: 0, total: 0, percent: 0 });
  const result = ref<UploadResourceResponse | null>(null);
  const error = ref<string | null>(null);
  const items = shallowRef<UploadItem[]>([]);

  /**
   * 单文件上传
   */
  async function upload(file: File, opts?: { signal?: AbortSignal }) {
    uploading.value = true;
    error.value = null;
    result.value = null;
    progress.value = { loaded: 0, total: file.size || 0, percent: 0 };
    try {
      const res = await resourceApi.smartUpload(file, {
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

  /**
   * 多文件上传
   * @keyword-en upload-multiple
   * @returns 包含 results 和 items 的对象，items 包含每个文件的进度和状态
   */
  async function uploadMultiple(files: File[], opts?: { signal?: AbortSignal }): Promise<{ results: UploadResourceResponse[]; items: UploadItem[] }> {
    uploading.value = true;
    error.value = null;
    result.value = null;

    const totalSize = files.reduce((s, f) => s + f.size, 0);
    progress.value = { loaded: 0, total: totalSize, percent: 0 };

    // 初始化上传项
    const uploadItems: UploadItem[] = files.map((file, idx) => ({
      id: `upload-${Date.now()}-${idx}`,
      file,
      status: 'pending',
      progress: 0,
    }));
    items.value = uploadItems;

    try {
      const results: UploadResourceResponse[] = [];
      let totalLoaded = 0;

      for (const item of uploadItems) {
        item.status = 'uploading';
        const abortCtrl = new AbortController();
        item.abortController = abortCtrl;

        try {
          const res = await resourceApi.smartUpload(item.file, {
            signal: abortCtrl.signal,
            onChunkProgress: (_idx, _total, _cLoaded, cTotalLoaded) => {
              item.progress = Math.min(99, Math.round((cTotalLoaded / item.file.size) * 100));
              totalLoaded = cTotalLoaded;
              progress.value = {
                loaded: totalLoaded,
                total: totalSize,
                percent: totalSize > 0 ? Math.min(99, Math.round((totalLoaded / totalSize) * 100)) : 0,
              };
            },
          });
          item.result = res.data;
          item.status = 'done';
          item.progress = 100;
          results.push(res.data);
        } catch (e) {
          item.status = 'error';
          item.error = e instanceof Error ? e.message : String(e);
        }
      }

      if (results.length > 0) {
        result.value = results[0];
      }
      return { results, items: uploadItems };
    } finally {
      uploading.value = false;
    }
  }

  /**
   * 取消上传
   */
  function abort(itemId?: string) {
    if (itemId) {
      const item = items.value.find(i => i.id === itemId);
      item?.abortController?.abort();
    }
  }

  /**
   * 取消所有上传
   */
  function abortAll() {
    for (const item of items.value) {
      item.abortController?.abort();
    }
  }

  return { uploading, progress, result, error, items, upload, uploadMultiple, abort, abortAll };
}
