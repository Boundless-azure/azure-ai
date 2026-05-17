/**
 * @title Storage Types
 * @description Storage module type definitions
 * @keywords-cn 存储类型, 资源库类型
 * @keywords-en storage-types, resource-library-types
 */

// 存储节点类型
export type StorageNodeType = 'folder' | 'file';

// 分享模式
export type ShareMode = 'none' | 'temp' | 'permanent' | 'password';

// 存储节点
export interface StorageNode {
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
  shareExpiresAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// 创建节点请求
export interface CreateNodeRequest {
  parentPath?: string;
  name: string;
  type: StorageNodeType;
  resourceId?: string | null;
  size?: number | null;
  mimeType?: string | null;
}

// 更新节点请求
export interface UpdateNodeRequest {
  name?: string;
  parentPath?: string;
}

// 分享请求
export interface CreateShareRequest {
  mode: ShareMode;
  password?: string;
  expiresIn?: number;
}

// 分享响应
export interface ShareLinkResponse {
  token: string;
  url: string;
  expiresAt: string | null;
  passwordRequired: boolean;
}

// 列表查询
export interface ListNodesQuery {
  path?: string;
  type?: StorageNodeType;
  q?: string;
}
