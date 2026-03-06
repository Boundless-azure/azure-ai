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

export const UploadResourceResponseSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  md5: z.string().min(1),
  duplicated: z.boolean(),
});
