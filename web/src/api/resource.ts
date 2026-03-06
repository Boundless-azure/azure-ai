/**
 * @title Resource API
 * @description 统一资源上传/访问接口定义，支持上传进度与资源ID返回。
 * @keywords-cn 资源上传API, 进度, 资源ID, 统一接口
 * @keywords-en resource-api, upload-progress, resource-id, unified
 */

import type { BaseResponse } from '../utils/types';
import type { UploadResourceResponse } from '../modules/resource/types/resource.types';

type UploadOptions = {
  onProgress?: (progress: {
    loaded: number;
    total: number;
    percent: number;
  }) => void;
  signal?: AbortSignal;
};

const resolvedBase = (() => {
  const envBase = import.meta.env?.PUBLIC_API_BASE_URL as string | undefined;
  if (envBase && envBase.startsWith('/')) return envBase;
  if (envBase && envBase.startsWith('http')) {
    const isLocal = /localhost|127\.0\.0\.1/.test(envBase);
    return isLocal ? '/api' : envBase;
  }
  return '/api';
})();

export const resourceApi = {
  upload: (file: File, options?: UploadOptions) => {
    const token = localStorage.getItem('token');
    const url = `${resolvedBase}/resources/upload`;
    const formData = new FormData();
    formData.append('file', file);

    return new Promise<BaseResponse<UploadResourceResponse>>(
      (resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.responseType = 'json';

        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        xhr.upload.onprogress = (evt) => {
          if (!options?.onProgress) return;
          const total = evt.total || file.size || 0;
          const loaded = evt.loaded || 0;
          const percent =
            total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
          options.onProgress({ loaded, total, percent });
        };

        const onAbort = () => {
          try {
            xhr.abort();
          } catch {
            void 0;
          }
        };
        if (options?.signal) {
          if (options.signal.aborted) {
            onAbort();
            reject(new Error('Upload aborted'));
            return;
          }
          options.signal.addEventListener('abort', onAbort, { once: true });
        }

        xhr.onerror = () => {
          if (options?.signal) {
            options.signal.removeEventListener('abort', onAbort);
          }
          reject(new Error('Upload failed'));
        };

        xhr.onload = () => {
          if (options?.signal) {
            options.signal.removeEventListener('abort', onAbort);
          }
          const status = xhr.status;
          if (status < 200 || status >= 300) {
            reject(new Error(`HTTP Error: ${status}`));
            return;
          }

          const json = xhr.response as unknown;
          const isWrapped =
            json !== null &&
            typeof json === 'object' &&
            'data' in json &&
            'code' in json;

          if (isWrapped) {
            resolve(json as BaseResponse<UploadResourceResponse>);
            return;
          }

          resolve({
            code: status,
            data: json as UploadResourceResponse,
            message: 'success',
            timestamp: Date.now(),
          });
        };

        try {
          xhr.send(formData);
        } catch (e) {
          if (options?.signal) {
            options.signal.removeEventListener('abort', onAbort);
          }
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      },
    );
  },
};
