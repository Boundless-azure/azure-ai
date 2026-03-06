import { IsString, IsOptional, Length } from 'class-validator';

/**
 * @title 资源上传响应
 * @description 统一资源上传接口返回：资源ID、访问路径、MD5 与是否命中去重。
 * @keywords-cn 上传响应, 资源ID, 访问路径, MD5, 去重
 * @keywords-en upload-response, resource-id, access-path, md5, dedup
 */
export interface UploadResourceResponse {
  id: string;
  path: string;
  md5: string;
  duplicated: boolean;
}

/**
 * @title 更新资源元信息请求
 * @description 预留：用于后续扩展资源元信息更新。
 * @keywords-cn 资源更新, 元信息, 预留
 * @keywords-en resource-update, metadata, reserved
 */
export class UpdateResourceDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  originalName?: string;
}
