import { z } from 'zod';
import { StorageNodeType, ShareMode } from '../entities/storage-node.entity';

export { StorageNodeType };

const storageNodeNameSchema = z
  .string()
  .min(1)
  .max(255)
  .refine((value) => !value.includes('/'), {
    message: 'name must not contain "/"',
  });

// 创建节点请求
export const CreateStorageNodeSchema = z.object({
  parentPath: z
    .string()
    .optional()
    .describe('父目录路径, 例如 "/" 或 "/workspace"; 不传默认为根目录'),
  name: storageNodeNameSchema,
  type: z.nativeEnum(StorageNodeType),
  resourceId: z.string().optional().nullable(),
  size: z.number().optional().nullable(),
  mimeType: z.string().optional().nullable(),
});

export type CreateStorageNodeRequest = z.infer<typeof CreateStorageNodeSchema>;

// 更新节点请求
export const UpdateStorageNodeSchema = z.object({
  name: storageNodeNameSchema.optional(),
  parentPath: z
    .string()
    .optional()
    .describe('移动到的父目录路径, 例如 "/" 或 "/workspace"; 不传则不移动'),
});

export type UpdateStorageNodeRequest = z.infer<typeof UpdateStorageNodeSchema>;

// 创建分享请求
export const CreateShareSchema = z.object({
  mode: z.nativeEnum(ShareMode),
  password: z.string().optional(),
  expiresIn: z.number().optional(), // 临时分享的过期时间（秒）
});

export type CreateShareRequest = z.infer<typeof CreateShareSchema>;

// 节点列表查询
export const ListStorageNodesSchema = z.object({
  path: z
    .string()
    .optional()
    .describe('目录路径, 例如 "/" 或 "/workspace"; 不传默认为根目录'),
  type: z.nativeEnum(StorageNodeType).optional(),
  q: z.string().optional(),
});

export type ListStorageNodesQuery = z.infer<typeof ListStorageNodesSchema>;

// 节点响应
export interface StorageNodeResponse {
  id: string;
  tenantId: string;
  name: string;
  type: StorageNodeType;
  path: string;
  size: string | null;
  mimeType: string | null;
  resourceId: string | null;
  shareMode: ShareMode;
  shareToken: string | null;
  shareExpiresAt: Date | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 分享响应
export interface ShareLinkResponse {
  token: string;
  url: string;
  expiresAt: Date | null;
  passwordRequired: boolean;
}

// 复制节点请求
export const CopyNodesSchema = z.object({
  nodeIds: z.array(z.string()).min(1),
  targetPath: z.string().describe('目标目录路径, 例如 "/" 或 "/workspace"'),
});

export type CopyNodesRequest = z.infer<typeof CopyNodesSchema>;
