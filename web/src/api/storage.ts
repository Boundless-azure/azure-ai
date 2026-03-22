/**
 * @title Storage API
 * @description Storage module API calls
 * @keywords-cn 存储API, 资源库API
 * @keywords-en storage-api, resource-library-api
 */
import { http } from '../utils/http';
import type {
  StorageNode,
  CreateNodeRequest,
  UpdateNodeRequest,
  CreateShareRequest,
  ShareLinkResponse,
  ListNodesQuery,
} from '../modules/storage/types/storage.types';
import type { UploadResourceResponse } from '../modules/resource/types/resource.types';

interface BaseResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

// 获取根目录节点
export async function getRootNodes(): Promise<StorageNode[]> {
  const res = await http.get<BaseResponse<StorageNode[]>>('/storage/nodes/root');
  return res.data.data;
}

// 获取节点列表
export async function listNodes(query: ListNodesQuery): Promise<StorageNode[]> {
  const res = await http.get<BaseResponse<StorageNode[]>>('/storage/nodes', query);
  return res.data.data;
}

// 获取节点详情
export async function getNode(id: string): Promise<StorageNode> {
  const res = await http.get<BaseResponse<StorageNode>>(`/storage/nodes/${id}`);
  return res.data.data;
}

// 创建节点
export async function createNode(data: CreateNodeRequest): Promise<StorageNode> {
  const res = await http.post<BaseResponse<StorageNode>>('/storage/nodes', data);
  return res.data.data;
}

// 更新节点
export async function updateNode(id: string, data: UpdateNodeRequest): Promise<StorageNode> {
  const res = await http.put<BaseResponse<StorageNode>>(`/storage/nodes/${id}`, data);
  return res.data.data;
}

// 删除节点
export async function deleteNode(id: string): Promise<void> {
  await http.delete(`/storage/nodes/${id}`);
}

// 创建分享链接
export async function createShare(
  id: string,
  data: CreateShareRequest,
): Promise<ShareLinkResponse> {
  const res = await http.post<BaseResponse<ShareLinkResponse>>(
    `/storage/nodes/${id}/share`,
    data,
  );
  return res.data.data;
}

// 删除分享链接
export async function removeShare(id: string): Promise<void> {
  await http.delete(`/storage/nodes/${id}/share`);
}

// 获取分享内容
export async function getShareContent(
  token: string,
  password?: string,
): Promise<StorageNode> {
  const res = await http.get<BaseResponse<StorageNode>>(
    `/storage/share/${token}`,
    password ? { password } : undefined,
  );
  return res.data.data;
}

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

type UploadOptions = {
  onProgress?: (progress: { loaded: number; total: number; percent: number }) => void;
  signal?: AbortSignal;
};

/**
 * 资源库文件上传（自动完成：统一上传 + 创建 storage_node）
 * @param file 文件
 * @param parentId 父目录 ID（null 表示根目录）
 * @param options 上传选项
 */
export function storageUpload(
  file: File,
  parentId: string | null,
  options?: UploadOptions,
): Promise<StorageNode> {
  return new Promise((resolve, reject) => {
    const xhr = createXhr('POST', '/api/storage/upload');
    const formData = new FormData();
    formData.append('file', file);
    if (parentId !== null) {
      formData.append('parentId', parentId);
    }

    xhr.upload.onprogress = (evt) => {
      options?.onProgress?.({
        loaded: evt.loaded,
        total: evt.total,
        percent: evt.total > 0 ? Math.min(100, Math.round((evt.loaded / evt.total) * 100)) : 0,
      });
    };

    const onAbort = () => { xhr.abort(); };
    options?.signal?.addEventListener('abort', onAbort, { once: true });

    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.onload = () => {
      options?.signal?.removeEventListener('abort', onAbort);
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`HTTP ${xhr.status}`));
        return;
      }
      const res = xhr.response as BaseResponse<StorageNode>;
      resolve(res.data);
    };
    xhr.onabort = () => { options?.signal?.removeEventListener('abort', onAbort); reject(new Error('Upload aborted')); };
    xhr.send(formData);
  });
}

/**
 * 复制存储节点（支持文件和文件夹递归复制）
 * @param nodeIds 要复制的节点 ID 列表
 * @param targetParentId 目标父目录 ID（null 表示根目录）
 */
export async function storageNodeCopy(
  nodeIds: string[],
  targetParentId: string | null,
): Promise<StorageNode[]> {
  const res = await http.post<BaseResponse<StorageNode[]>>(
    '/storage/nodes/copy',
    { nodeIds, targetParentId },
  );
  return res.data.data;
}
