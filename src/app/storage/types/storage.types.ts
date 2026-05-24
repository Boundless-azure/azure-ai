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
//
// type=file 时 resourceId 必填且非空: resourceId 必须来源于"用户在聊天对话框上传的文件",
// 通过 saas.app.resource.currentSession 查询本会话已上传文件后取 items[].resourceId。
// LLM 不允许编造或猜测 resourceId; 不允许从 markdown 链接 / URL 中反向 parse。
// 系统永不主动凭空创建文件节点; 必须先由真实用户上传, 资源落库后才能 createNode。
export const CreateStorageNodeSchema = z
  .object({
    parentPath: z
      .string()
      .optional()
      .describe('父目录路径, 例如 "/" 或 "/workspace"; 不传默认为根目录'),
    name: storageNodeNameSchema,
    type: z
      .nativeEnum(StorageNodeType)
      .describe('folder=文件夹; file=文件 (此时 resourceId 必填)'),
    resourceId: z
      .string()
      .min(1)
      .optional()
      .nullable()
      .describe(
        'type=file 时必填; 必须是用户在当前聊天上传的真实资源 ID (来自 saas.app.resource.currentSession 的 items[].resourceId), 禁止编造',
      ),
    size: z.number().optional().nullable(),
    mimeType: z.string().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.type === StorageNodeType.FILE) {
      const rid = value.resourceId?.trim();
      if (!rid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['resourceId'],
          message:
            'type=file 时 resourceId 必填: 必须使用用户在当前聊天对话框上传的文件的 resourceId。' +
            '请先调用 saas.app.resource.currentSession 查询本会话已上传的文件, 拿到 items[].resourceId 后再调用本 hook。' +
            '如果用户尚未上传文件, 请通过 sendMsg 提示用户上传, 不要凭空创建。',
        });
      }
    }
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
