import {
  IsString,
  IsOptional,
  Length,
  IsNumber,
  IsInt,
  Min,
} from 'class-validator';
import { z } from 'zod';

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
 * @title 分片上传初始化响应
 * @description 初始化分片上传后返回：上传ID、是否恢复上传、缺失分片列表。
 * @keywords-cn 分片上传, 初始化, 断点续传, 缺失分片
 * @keywords-en chunked-upload-init, resume, missing-chunks
 */
export interface ChunkedUploadInitResponse {
  /** 资源ID（最终资源ID） */
  id: string;
  /** 上传会话ID（等同于资源ID） */
  uploadId: string;
  /** 是否为恢复上传 */
  resumed: boolean;
  /** 缺失的分片索引列表 */
  missingChunks: number[];
  /** 总分片数 */
  totalChunks: number;
}

/**
 * @title 分片上传完成响应
 * @description 分片合并完成后返回：资源ID、访问路径、SHA256 与是否重复。
 * @keywords-cn 分片合并, 完成, SHA256, 去重
 * @keywords-en chunk-commit, merge, sha256, dedup
 */
export interface ChunkedUploadCommitResponse {
  id: string;
  path: string;
  sha256: string;
  duplicated: boolean;
}

/**
 * @title 分片上传初始化请求
 * @description 前端发起分片上传前先调用此接口获取上传会话。
 * @keywords-cn 分片, 初始化, 会话, 请求
 * @keywords-en chunk-init, session, request
 */
export class InitChunkedUploadDto {
  @IsString()
  filename!: string;

  @IsInt()
  @Min(1)
  totalChunks!: number;

  @IsNumber()
  fileSize!: number;

  @IsString()
  md5!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;
}

/**
 * @title 分片上传元信息响应
 * @description 前端通过此接口查询断点续传状态。
 * @keywords-cn 分片状态, 断点, 续传, 已上传
 * @keywords-en chunk-status, resume, uploaded
 */
export interface ChunkStatusResponse {
  uploadedChunks: number[];
  missingChunks: number[];
}

/**
 * @title 粘贴资源请求
 * @description 通过资源ID列表批量复制资源到目标位置。
 * @keywords-cn 粘贴, 批量复制, 资源ID
 * @keywords-en paste, batch-copy, resource-ids
 */
export const BatchDuplicateSchema = z.object({
  resourceIds: z.array(z.string().min(1)).min(1).max(50),
});

export type BatchDuplicateRequest = z.infer<typeof BatchDuplicateSchema>;

export interface BatchDuplicateResponse {
  items: Array<{
    id: string;
    originalId: string;
    path: string;
    name: string;
  }>;
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
