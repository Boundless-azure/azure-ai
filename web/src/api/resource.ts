/**
 * @title Resource API
 * @description 统一资源上传/访问接口定义，支持简单上传、多文件上传、分片上传、断点续传和批量复制。
 * @keywords-cn 资源上传API, 分片上传, 断点续传, 批量复制
 * @keywords-en resource-api, chunked-upload, resume, batch-copy
 */

import type { BaseResponse } from '../utils/types';
import type {
  ResourceListItem,
  UploadResourceResponse,
} from '../modules/resource/types/resource.types';
import { ResourceListQuerySchema } from '../modules/resource/types/resource.types';

type UploadOptions = {
  onProgress?: (progress: {
    loaded: number;
    total: number;
    percent: number;
  }) => void;
  signal?: AbortSignal;
  sessionId?: string;
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

function getToken(): string | null {
  return localStorage.getItem('token');
}

function createXhr(method: string, url: string): XMLHttpRequest {
  const xhr = new XMLHttpRequest();
  xhr.open(method, url);
  xhr.responseType = 'json';
  const token = getToken();
  if (token) {
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  }
  return xhr;
}

/**
 * 兼容资源接口的原始响应与统一 BaseResponse 响应。
 * @keyword-en normalize-resource-api-response
 */
function asBaseResponse<T>(payload: unknown): BaseResponse<T> {
  if (
    payload !== null &&
    typeof payload === 'object' &&
    'data' in payload &&
    'code' in payload
  ) {
    return payload as BaseResponse<T>;
  }
  return {
    code: 200,
    data: payload as T,
    message: 'success',
    timestamp: Date.now(),
  };
}

// 分片大小 2MB
const CHUNK_SIZE = 2 * 1024 * 1024;

export interface ChunkedUploadInitResult {
  id: string;
  uploadId: string;
  resumed: boolean;
  missingChunks: number[];
  totalChunks: number;
}

export interface ChunkedUploadCommitResult {
  id: string;
  path: string;
  sha256: string;
  duplicated: boolean;
}

export interface ChunkStatusResult {
  uploadedChunks: number[];
  missingChunks: number[];
}

/**
 * 计算文件的浏览器侧 hash, 用于分片上传 `initChunkedUpload` 的"预去重" md5 字段。
 *
 * 实现说明:
 *   - Web Crypto `crypto.subtle.digest` 不支持 MD5 (MDN: 仅 SHA-1/256/384/512)。
 *     早期版本传 'MD5' 会抛 `OperationError: Unsupported algorithm`, 导致所有 >=10MB 文件 (视频/大图等)
 *     在前端 catch 显示"附件上传失败"。
 *   - 改走 SHA-256, 取 hex 前 32 字符 (与 MD5 长度对齐, 后端 md5 字段是 varchar(64) 兼容)。
 *   - 后端 service.commitChunkedUpload 阶段会再次算真 SHA-256 做最终去重, 这里 md5 只是预去重提示,
 *     真伪 MD5 算法都不影响正确性, 最坏情况是同内容文件多走一次完整分片上传。
 *
 * @keyword-en compute-file-hash-fallback, sha256-as-md5, browser-md5-unsupported
 */
async function computeMd5Full(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

export const resourceApi = {
  list: async (params?: {
    sessionId?: string;
    category?: string;
    q?: string;
    limit?: number;
  }): Promise<BaseResponse<ResourceListItem[]>> => {
    const parsed = ResourceListQuerySchema.parse(params ?? {});
    const search = new URLSearchParams();
    Object.entries(parsed).forEach(([key, value]) => {
      if (value !== undefined && value !== null) search.set(key, String(value));
    });
    const qs = search.toString();
    const res = await fetch(`${resolvedBase}/resources${qs ? `?${qs}` : ''}`, {
      headers: { ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    });
    return asBaseResponse<ResourceListItem[]>(await res.json());
  },

  // ==================== 简单上传 ====================
  upload: (file: File, options?: UploadOptions): Promise<BaseResponse<UploadResourceResponse>> => {
    return new Promise((resolve, reject) => {
      const xhr = createXhr('POST', `${resolvedBase}/resources/upload`);
      const formData = new FormData();
      formData.append('file', file);
      if (options?.sessionId) formData.append('sessionId', options.sessionId);

      xhr.upload.onprogress = (evt) => {
        options?.onProgress?.({
          loaded: evt.loaded,
          total: evt.total,
          percent: evt.total > 0 ? Math.min(100, Math.round((evt.loaded / evt.total) * 100)) : 0,
        });
      };

      const cleanup = () => options?.signal?.removeEventListener('abort', onAbort);

      const onAbort = () => { xhr.abort(); };
      options?.signal?.addEventListener('abort', onAbort, { once: true });

      xhr.onerror = () => { cleanup(); reject(new Error('Upload failed')); };
      xhr.onload = () => {
        cleanup();
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(`HTTP ${xhr.status}`));
          return;
        }
        resolve(asBaseResponse<UploadResourceResponse>(xhr.response));
      };
      xhr.onabort = () => { cleanup(); reject(new Error('Upload aborted')); };
      xhr.send(formData);
    });
  },

  // ==================== 多文件上传 ====================
  uploadMultiple: (files: File[], options?: UploadOptions): Promise<BaseResponse<UploadResourceResponse[]>> => {
    return new Promise((resolve, reject) => {
      const xhr = createXhr('POST', `${resolvedBase}/resources/upload/multiple`);
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      if (options?.sessionId) formData.append('sessionId', options.sessionId);

      let loaded = 0;
      const total = files.reduce((sum, f) => sum + f.size, 0);

      xhr.upload.onprogress = (evt) => {
        // 累计进度
        const delta = evt.loaded - loaded;
        loaded = evt.loaded;
        options?.onProgress?.({
          loaded: evt.loaded,
          total: evt.total,
          percent: evt.total > 0 ? Math.min(100, Math.round((evt.loaded / evt.total) * 100)) : 0,
        });
      };

      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(`HTTP ${xhr.status}`));
          return;
        }
        resolve(asBaseResponse<UploadResourceResponse[]>(xhr.response));
      };
      xhr.send(formData);
    });
  },

  // ==================== 分片上传初始化 ====================
  initChunkedUpload: async (
    filename: string,
    totalChunks: number,
    fileSize: number,
    md5: string,
    mimeType: string,
    sessionId?: string,
  ): Promise<BaseResponse<ChunkedUploadInitResult>> => {
    const res = await fetch(`${resolvedBase}/resources/chunked/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: JSON.stringify({ filename, totalChunks, fileSize, md5, mimeType, sessionId }),
    });
    return asBaseResponse<ChunkedUploadInitResult>(await res.json());
  },

  // ==================== 上传单个分片 ====================
  uploadChunk: (uploadId: string, chunkIndex: number, chunk: Blob, options?: UploadOptions): Promise<BaseResponse<{ received: boolean }>> => {
    return new Promise((resolve, reject) => {
      const xhr = createXhr('POST', `${resolvedBase}/resources/chunked/upload`);
      const formData = new FormData();
      formData.append('uploadId', uploadId);
      formData.append('chunkIndex', String(chunkIndex));
      formData.append('chunk', chunk);

      xhr.upload.onprogress = (evt) => {
        options?.onProgress?.({
          loaded: evt.loaded,
          total: evt.total,
          percent: evt.total > 0 ? Math.min(100, Math.round((evt.loaded / evt.total) * 100)) : 0,
        });
      };

      xhr.onerror = () => reject(new Error('Chunk upload failed'));
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(`HTTP ${xhr.status}`));
          return;
        }
        resolve(asBaseResponse<{ received: boolean }>(xhr.response));
      };
      xhr.send(formData);
    });
  },

  // ==================== 查询分片状态（断点续传） ====================
  getChunkStatus: async (uploadId: string): Promise<BaseResponse<ChunkStatusResult>> => {
    const res = await fetch(`${resolvedBase}/resources/chunked/status/${uploadId}`, {
      headers: { Authorization: `Bearer ${getToken()}` ?? '' },
    });
    return asBaseResponse<ChunkStatusResult>(await res.json());
  },

  // ==================== 完成分片上传 ====================
  commitChunkedUpload: async (uploadId: string): Promise<BaseResponse<ChunkedUploadCommitResult>> => {
    const res = await fetch(`${resolvedBase}/resources/chunked/commit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: JSON.stringify({ uploadId }),
    });
    return asBaseResponse<ChunkedUploadCommitResult>(await res.json());
  },

  // ==================== 取消分片上传 ====================
  abortChunkedUpload: async (uploadId: string): Promise<BaseResponse<{ success: boolean }>> => {
    const res = await fetch(`${resolvedBase}/resources/chunked/abort/${uploadId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` ?? '' },
    });
    return asBaseResponse<{ success: boolean }>(await res.json());
  },

  // ==================== 批量复制资源（粘贴） ====================
  batchCopy: async (resourceIds: string[]): Promise<BaseResponse<{ items: Array<{ id: string; originalId: string; path: string; name: string }> }>> => {
    const res = await fetch(`${resolvedBase}/resources/batch/copy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: JSON.stringify({ resourceIds }),
    });
    return asBaseResponse<{
      items: Array<{
        id: string;
        originalId: string;
        path: string;
        name: string;
      }>;
    }>(await res.json());
  },

  // ==================== 智能分片上传（自动选择简单/分片） ====================
  smartUpload: async (
    file: File,
    options?: UploadOptions & { onChunkProgress?: (idx: number, total: number, loaded: number, totalLoaded: number, totalSize: number) => void },
  ): Promise<BaseResponse<UploadResourceResponse>> => {
    // 小文件直接简单上传
    if (file.size < 10 * 1024 * 1024) {
      return resourceApi.upload(file, options);
    }

    // 大文件分片上传
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const md5 = await computeMd5Full(file);

    // 1. 初始化
    const initRes = await resourceApi.initChunkedUpload(file.name, totalChunks, file.size, md5, file.type || 'application/octet-stream', options?.sessionId);
    const { uploadId, missingChunks, resumed } = initRes.data;

    // 2. 上传缺失分片
    let totalLoaded = 0;
    const uploadedSize = (totalChunks - missingChunks.length) * CHUNK_SIZE;
    totalLoaded += uploadedSize;

    for (const idx of missingChunks) {
      const start = idx * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      await resourceApi.uploadChunk(uploadId, idx, chunk, {
        onProgress: (p) => {
          options?.onChunkProgress?.(idx, totalChunks, p.loaded, totalLoaded + p.loaded, file.size);
          options?.onProgress?.({
            loaded: totalLoaded + p.loaded,
            total: file.size,
            percent: Math.min(100, Math.round(((totalLoaded + p.loaded) / file.size) * 100)),
          });
        },
        signal: options?.signal,
      });
      totalLoaded += CHUNK_SIZE;
    }

    // 3. 完成
    const commitRes = await resourceApi.commitChunkedUpload(uploadId);
    return {
      code: 200,
      data: { id: commitRes.data.id, path: commitRes.data.path, md5, duplicated: commitRes.data.duplicated },
      message: 'success',
      timestamp: Date.now(),
    };
  },
};
