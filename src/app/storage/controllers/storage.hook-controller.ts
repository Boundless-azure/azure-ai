import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import type { HookInvocationContext } from '@/core/hookbus/types/hook.types';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { StorageService } from '../services/storage.service';
import { ResourceService } from '../../resource/services/resource.service';
import { ResourceSignService } from '../../resource/services/resource-sign.service';
import {
  type CreateStorageNodeRequest,
  CreateStorageNodeSchema,
  UpdateStorageNodeSchema,
  CreateShareSchema,
  type ListStorageNodesQuery,
  ListStorageNodesSchema,
  StorageNodeType,
  CopyNodesSchema,
} from '../types/storage.types';
import {
  resolveStorageTenantId,
  resolveStorageUserId,
  toStorageNodeResponse,
  toStorageNodeResponseList,
} from './storage.controller';

/** 单对象 hook payload: id 平铺进对象 (id+body → { id, ...body }) */
const idField = z.object({ id: z.string() });
const UpdateNodeHookSchema = idField.merge(UpdateStorageNodeSchema);
const CreateShareHookSchema = idField.merge(CreateShareSchema);

/**
 * @title Storage Hook Controller
 * @description storage 模块的 hook 声明层 (单对象 payload); 从 StorageController 迁出, HTTP 与 hook 解耦。
 *   每个 hook 直接调 StorageService, 租户/用户从 invocationContext 解析。
 * @keywords-cn 存储Hook声明, 单对象payload
 * @keywords-en storage-hook-controller, single-object-payload
 */
@Injectable()
@HookController({ pluginName: 'storage', tags: ['storage', 'file'] })
export class StorageHookController {
  private readonly logger = new Logger(StorageHookController.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly resourceService: ResourceService,
    private readonly sign: ResourceSignService,
  ) {}

  /**
   * 创建节点 (文件夹或文件); file 类型强制校验 resourceId 归属当前租户。
   * @keyword-cn 创建节点, 文件节点
   * @keyword-en create-node, file-node
   */
  @HookRoute({
    hook: 'saas.app.storage.createNode',
    description:
      'Storage 节点创建 (文件夹或文件)。type=file 时 resourceId 必填, 且必须来自用户在当前聊天对话框上传的文件 ' +
      '(通过 saas.app.resource.currentSession 查询拿到)。LLM 禁止编造 resourceId; 用户未上传时请用 sendMsg 提示其上传。',
    args: [CreateStorageNodeSchema],
  })
  @CheckAbility('create', 'storage')
  async createNode(
    payload: CreateStorageNodeRequest,
    _principal: unknown,
    context?: HookInvocationContext,
  ) {
    const tenantId = resolveStorageTenantId(undefined, context);
    const userId = resolveStorageUserId(undefined, context);
    if (payload.type === StorageNodeType.FILE) {
      const resourceId = payload.resourceId?.trim();
      if (!resourceId) {
        throw new BadRequestException(
          'createNode type=file 必须提供 resourceId: 该 ID 必须来自用户在当前聊天对话框上传的文件 ' +
            '(请先调用 saas.app.resource.currentSession 查询)。LLM 禁止编造 resourceId。',
        );
      }
      const resource = await this.resourceService.getResourceById(resourceId);
      if (!resource) {
        throw new BadRequestException(
          `createNode 失败: resourceId="${resourceId}" 不存在。` +
            '请通过 saas.app.resource.currentSession 重新查询当前会话已上传文件后再试; 禁止编造或猜测 ID。',
        );
      }
      if (resource.channelId && resource.channelId !== tenantId) {
        throw new BadRequestException(
          `createNode 失败: resourceId="${resourceId}" 属于其它租户, 当前租户无访问权限。`,
        );
      }
    }
    const node = await this.storageService.createNode(tenantId, userId, payload);
    return { success: true, data: toStorageNodeResponse(node, this.sign) };
  }

  /**
   * 批量复制节点 (递归 + 自动改名)。
   * @keyword-cn 复制节点, 递归复制
   * @keyword-en copy-nodes, recursive-copy
   */
  @HookRoute({
    hook: 'saas.app.storage.copyNodes',
    description: 'Storage 节点批量复制 (递归 + 自动改名)',
    args: [CopyNodesSchema],
  })
  @CheckAbility('create', 'storage')
  async copyNodes(
    payload: z.infer<typeof CopyNodesSchema>,
    _principal: unknown,
    context?: HookInvocationContext,
  ) {
    const tenantId = resolveStorageTenantId(undefined, context);
    const userId = resolveStorageUserId(undefined, context);
    const nodes = await this.storageService.copyNodes(
      payload.nodeIds,
      payload.targetPath,
      tenantId,
      userId,
      async (resourceId: string) =>
        await this.resourceService.duplicate(resourceId, userId),
    );
    return { success: true, data: toStorageNodeResponseList(nodes, this.sign) };
  }

  /**
   * 节点列表查询 (按 path 取目录子节点)。
   * @keyword-cn 节点列表, 目录查询
   * @keyword-en list-nodes, directory-query
   */
  @HookRoute({
    hook: 'saas.app.storage.listNodes',
    description:
      'Storage 节点列表查询 (按 path 取目录子节点; path="/" 为根目录; 支持 type / q 过滤)',
    args: [ListStorageNodesSchema],
  })
  @CheckAbility('read', 'storage')
  async listNodes(
    payload: ListStorageNodesQuery,
    _principal: unknown,
    context?: HookInvocationContext,
  ) {
    const tenantId = resolveStorageTenantId(undefined, context);
    const nodes = await this.storageService.listNodes(tenantId, payload);
    return { success: true, data: toStorageNodeResponseList(nodes, this.sign) };
  }

  /**
   * 根目录节点列表。
   * @keyword-cn 根目录, 节点列表
   * @keyword-en root-nodes, node-list
   */
  @HookRoute({
    hook: 'saas.app.storage.getRootNodes',
    description: 'Storage 根目录节点列表',
    args: [],
  })
  @CheckAbility('read', 'storage')
  async getRootNodes(_principal: unknown, context?: HookInvocationContext) {
    const tenantId = resolveStorageTenantId(undefined, context);
    const nodes = await this.storageService.getRootNodes(tenantId);
    return { success: true, data: toStorageNodeResponseList(nodes, this.sign) };
  }

  /**
   * 节点详情。
   * @keyword-cn 节点详情, 读取
   * @keyword-en get-node, read-detail
   */
  @HookRoute({
    hook: 'saas.app.storage.getNode',
    description: 'Storage 节点详情',
    args: [idField],
  })
  @CheckAbility('read', 'storage')
  async getNode(
    payload: { id: string },
    _principal: unknown,
    context?: HookInvocationContext,
  ) {
    const tenantId = resolveStorageTenantId(undefined, context);
    const node = await this.storageService.getNode(payload.id, tenantId);
    return { success: true, data: toStorageNodeResponse(node, this.sign) };
  }

  /**
   * 更新节点 (改名或移动 parent)。
   * @keyword-cn 更新节点, 改名移动
   * @keyword-en update-node, rename-move
   */
  @HookRoute({
    hook: 'saas.app.storage.updateNode',
    description: 'Storage 节点更新 (改名或移动 parent)',
    args: [UpdateNodeHookSchema],
  })
  @CheckAbility('update', 'storage')
  async updateNode(
    payload: z.infer<typeof UpdateNodeHookSchema>,
    _principal: unknown,
    context?: HookInvocationContext,
  ) {
    const tenantId = resolveStorageTenantId(undefined, context);
    const userId = resolveStorageUserId(undefined, context);
    const { id, ...body } = payload;
    const node = await this.storageService.updateNode(id, tenantId, userId, body);
    return { success: true, data: toStorageNodeResponse(node, this.sign) };
  }

  /**
   * 软删除节点 (整子树)。
   * @keyword-cn 删除节点, 软删
   * @keyword-en delete-node, soft-delete
   */
  @HookRoute({
    hook: 'saas.app.storage.deleteNode',
    description: 'Storage 节点软删除',
    args: [idField],
  })
  @CheckAbility('delete', 'storage')
  async deleteNode(
    payload: { id: string },
    _principal: unknown,
    context?: HookInvocationContext,
  ) {
    const tenantId = resolveStorageTenantId(undefined, context);
    await this.storageService.deleteNode(payload.id, tenantId);
    return { success: true };
  }

  /**
   * 创建分享。
   * @keyword-cn 创建分享, 外链
   * @keyword-en create-share, share-link
   */
  @HookRoute({
    hook: 'saas.app.storage.createShare',
    description: 'Storage 节点分享链接创建',
    args: [CreateShareHookSchema],
  })
  @CheckAbility('share', 'storage')
  async createShare(
    payload: z.infer<typeof CreateShareHookSchema>,
    _principal: unknown,
    context?: HookInvocationContext,
  ) {
    const tenantId = resolveStorageTenantId(undefined, context);
    const { id, ...body } = payload;
    const share = await this.storageService.createShare(id, tenantId, body);
    return { success: true, data: share };
  }

  /**
   * 取消分享。
   * @keyword-cn 取消分享, 清 token
   * @keyword-en remove-share, clear-token
   */
  @HookRoute({
    hook: 'saas.app.storage.removeShare',
    description: 'Storage 节点分享链接移除',
    args: [idField],
  })
  @CheckAbility('share', 'storage')
  async removeShare(
    payload: { id: string },
    _principal: unknown,
    context?: HookInvocationContext,
  ) {
    const tenantId = resolveStorageTenantId(undefined, context);
    await this.storageService.removeShare(payload.id, tenantId);
    return { success: true };
  }
}
