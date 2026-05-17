import { z } from 'zod';

/**
 * @title Upload Resource Response (Web)
 * @description 与后端 /resources/upload 返回结构对齐。
 * @keywords-cn 上传响应, 资源ID, 访问路径, MD5
 * @keywords-en upload-response, resource-id, access-path, md5
 */
export interface UploadResourceResponse {
  id: string;
  path: string;
  md5: string;
  duplicated: boolean;
}

/**
 * @title Resource List Item (Web)
 * @description 与后端 /resources 列表返回结构对齐。
 * @keywords-cn 资源列表, 会话文件, resources表
 * @keywords-en resource-list-item, session-files, resources-table
 */
export interface ResourceListItem {
  id: string;
  path: string;
  originalName: string;
  fileExt: string | null;
  mimeType: string | null;
  fileSize: string;
  category: string;
  sessionId: string | null;
  uploaderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const UploadResourceResponseSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  md5: z.string().min(1),
  duplicated: z.boolean(),
});

export const ResourceListQuerySchema = z.object({
  sessionId: z.string().optional(),
  category: z.string().optional(),
  q: z.string().optional(),
  limit: z.number().optional(),
});
