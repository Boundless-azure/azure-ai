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

/**
 * @description 校验资源上传响应结构。
 * @keyword-cn 上传响应, 资源校验, 访问路径
 * @keyword-en upload-response, resource-schema, access-path
 */
export const UploadResourceResponseSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  md5: z.string().min(1),
  duplicated: z.boolean(),
});

/**
 * @description 校验资源列表查询条件。
 * @keyword-cn 资源列表, 查询参数, 会话文件
 * @keyword-en resource-list, query-schema, session-files
 */
export const ResourceListQuerySchema = z.object({
  sessionId: z.string().optional(),
  category: z.string().optional(),
  q: z.string().optional(),
  limit: z.number().optional(),
});
