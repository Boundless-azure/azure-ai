import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Request } from 'express';
import { z } from 'zod';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import type { HookInvocationContext } from '@/core/hookbus/types/hook.types';
import { StorageService } from '../services/storage.service';
import { ResourceService } from '../../resource/services/resource.service';
import type { StorageNodeEntity } from '../entities/storage-node.entity';
import {
  type CreateStorageNodeRequest,
  CreateStorageNodeSchema,
  type UpdateStorageNodeRequest,
  UpdateStorageNodeSchema,
  type CreateShareRequest,
  CreateShareSchema,
  type ListStorageNodesQuery,
  ListStorageNodesSchema,
  StorageNodeType,
  type CopyNodesRequest,
  CopyNodesSchema,
} from '../types/storage.types';

/**
 * @title Storage Hook payload schema (input 形状, SSOT)
 * @description lifecycle 自动包成 envelope, 此处只声明 input 部分。
 * @keywords-cn StorageHook, payloadSchema, input
 * @keywords-en storage-hook, payload-schema, input
 */
const idParamInput = z.object({ id: z.string() });
const emptyInput = z.object({});

type AuthedReq = Request & { user?: { id?: string; tenantId?: string } };
type PrincipalLike = {
  id?: string;
  tenantId?: string;
  user?: { id?: string; tenantId?: string };
};

type MulterFileLike = {
  path: string;
  originalname: string;
  mimetype: string;
  size: number;
};

function isMulterFileLike(v: unknown): v is MulterFileLike {
  if (!v || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.path === 'string' &&
    typeof obj.originalname === 'string' &&
    typeof obj.mimetype === 'string' &&
    typeof obj.size === 'number'
  );
}

function tempDir(): string {
  const dir = path.join(os.tmpdir(), 'azure-ai-upload');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * 解析 Storage 租户 ID; Hook 调用优先使用 context.extras.tenantId, HTTP 调用使用 req.user.tenantId。
 * @keyword-en resolve-storage-tenant-id
 */
function resolveStorageTenantId(
  actor?: PrincipalLike | null,
  context?: HookInvocationContext,
): string {
  const fromContext = readString(context?.extras?.tenantId);
  if (fromContext) return fromContext;
  const fromActorTenant = readString(actor?.user?.tenantId ?? actor?.tenantId);
  if (fromActorTenant) return fromActorTenant;
  const fromActorId = readString(actor?.user?.id ?? actor?.id);
  if (fromActorId) return fromActorId;
  return readString(context?.principalId) ?? 'default';
}

/**
 * 解析 Storage 操作用户 ID; Hook 调用下通常为当前 agent principalId。
 * @keyword-en resolve-storage-user-id
 */
function resolveStorageUserId(
  actor?: PrincipalLike | null,
  context?: HookInvocationContext,
): string {
  return (
    readString(actor?.user?.id ?? actor?.id) ??
    readString(context?.principalId) ??
    'system'
  );
}

/**
 * 读取非空字符串。
 * @keyword-en read-non-empty-string
 */
function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * 输出 Storage 节点响应; 对外隐藏 parentId, 统一引导调用方使用 path。
 * @keyword-en to-storage-node-response
 */
function toStorageNodeResponse(node: StorageNodeEntity): Record<string, unknown> {
  const data = { ...node } as Record<string, unknown>;
  delete data['parentId'];
  delete data['parent'];
  return data;
}

/**
 * 输出 Storage 节点响应列表。
 * @keyword-en to-storage-node-response-list
 */
function toStorageNodeResponseList(
  nodes: StorageNodeEntity[],
): Array<Record<string, unknown>> {
  return nodes.map((node) => toStorageNodeResponse(node));
}

/**
 * @title Storage Controller
 * @description 资源库存储控制器，提供目录/文件管理和分享 API
 * @keywords-cn 存储控制器, 资源库, 文件管理, 分享
 * @keywords-en storage-controller, resource-library, file-management, share
 */
@HookController({ pluginName: 'storage', tags: ['storage', 'file'] })
@Controller('storage')
export class StorageController {
  private readonly logger = new Logger(StorageController.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly resourceService: ResourceService,
  ) {}

  /**
   * @title 创建节点
   * @description 创建文件夹或文件节点
   */
  @Post('nodes')
  @CheckAbility('create', 'storage')
  @HookRoute({
    hook: 'saas.app.storage.createNode',
    description: 'Storage 节点创建 (文件夹或文件)',
    args: [CreateStorageNodeSchema],
  })
  async createNode(
    @Body() body: CreateStorageNodeRequest,
    @Req() req: AuthedReq,
    context?: HookInvocationContext,
  ) {
    const tenantId = resolveStorageTenantId(req, context);
    const userId = resolveStorageUserId(req, context);
    const node = await this.storageService.createNode(tenantId, userId, body);
    return { success: true, data: toStorageNodeResponse(node) };
  }

  /**
   * @title 复制节点
   * @description 复制文件或文件夹（支持递归），自动重命名为 "xxx (copy)"
   */
  @Post('nodes/copy')
  @CheckAbility('create', 'storage')
  @HookRoute({
    hook: 'saas.app.storage.copyNodes',
    description: 'Storage 节点批量复制 (递归 + 自动改名)',
    args: [CopyNodesSchema],
  })
  async copyNodes(
    @Body() body: CopyNodesRequest,
    @Req() req: AuthedReq,
    context?: HookInvocationContext,
  ) {
    const tenantId = resolveStorageTenantId(req, context);
    const userId = resolveStorageUserId(req, context);

    const nodes = await this.storageService.copyNodes(
      body.nodeIds,
      body.targetPath,
      tenantId,
      userId,
      async (resourceId: string) => {
        return await this.resourceService.duplicate(resourceId, userId);
      },
    );

    return { success: true, data: toStorageNodeResponseList(nodes) };
  }

  /**
   * @title 资源库文件上传
   * @description 先调用统一上传获取 resourceId，再写入 storage_nodes（自动使用当前用户 tenantId）
   * @description-cn 资源库上传, 统一上传, resourceId, storage_nodes
   */
  @Post('upload')
  @CheckAbility('create', 'storage')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          cb(null, tempDir());
        },
        filename: (_req, file, cb) => {
          const base = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const ext = path.extname(file.originalname || '').toLowerCase();
          cb(null, `${base}${ext}`);
        },
      }),
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: unknown,
    @Body('parentPath') parentPath: string | undefined,
    @Req() req: AuthedReq,
  ) {
    if (!isMulterFileLike(file)) {
      throw new BadRequestException('file is required');
    }
    const tenantId = req.user?.tenantId ?? req.user?.id ?? 'default';
    const userId = req.user?.id ?? 'system';

    // 1. 调用统一上传服务
    const resource = await this.resourceService.upload(
      {
        path: file.path,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      userId,
    );

    // 2. 创建存储节点
    const node = await this.storageService.createNode(tenantId, userId, {
      name: file.originalname,
      type: StorageNodeType.FILE,
      parentPath: parentPath ?? '/',
      resourceId: resource.id,
      size: file.size,
      mimeType: file.mimetype,
    });

    return { success: true, data: toStorageNodeResponse(node) };
  }

  /**
   * @title 获取节点列表
   * @description 获取指定父节点下的所有子节点
   */
  @Get('nodes')
  @CheckAbility('read', 'storage')
  @HookRoute({
    hook: 'saas.app.storage.listNodes',
    description:
      'Storage 节点列表查询 (按 path 取目录子节点; path="/" 为根目录; 支持 type / q 过滤)',
    args: [ListStorageNodesSchema],
  })
  async listNodes(
    @Query() query: ListStorageNodesQuery,
    @Req() req: AuthedReq,
    context?: HookInvocationContext,
  ) {
    const tenantId = resolveStorageTenantId(req, context);
    const nodes = await this.storageService.listNodes(tenantId, query);
    return { success: true, data: toStorageNodeResponseList(nodes) };
  }

  /**
   * @title 获取根目录
   * @description 获取租户的根目录节点列表
   */
  @Get('nodes/root')
  @CheckAbility('read', 'storage')
  @HookRoute({
    hook: 'saas.app.storage.getRootNodes',
    description: 'Storage 根目录节点列表',
    args: [],
  })
  async getRootNodes(
    @Req() req: AuthedReq,
    context?: HookInvocationContext,
  ) {
    const tenantId = resolveStorageTenantId(req, context);
    this.logger.log(
      `[storage.getRootNodes] tenant=${tenantId} principal=${context?.principalId ?? req.user?.id ?? 'null'} ` +
        `source=${context?.source ?? 'http'} ctxTenant=${readString(context?.extras?.tenantId) ?? 'null'} ` +
        `reqTenant=${req.user?.tenantId ?? 'null'} reqUser=${req.user?.id ?? 'null'}`,
    );
    const nodes = await this.storageService.getRootNodes(tenantId);
    return { success: true, data: toStorageNodeResponseList(nodes) };
  }

  /**
   * @title 获取节点详情
   * @description 根据 ID 获取节点详情
   */
  @Get('nodes/:id')
  @CheckAbility('read', 'storage')
  @HookRoute({
    hook: 'saas.app.storage.getNode',
    description: 'Storage 节点详情',
    args: [idParamInput.shape.id],
  })
  async getNode(
    @Param('id') id: string,
    @Req() req: AuthedReq,
    context?: HookInvocationContext,
  ) {
    const tenantId = resolveStorageTenantId(req, context);
    const node = await this.storageService.getNode(id, tenantId);
    return { success: true, data: toStorageNodeResponse(node) };
  }

  /**
   * @title 更新节点
   * @description 更新节点名称或移动节点位置
   */
  @Put('nodes/:id')
  @CheckAbility('update', 'storage')
  @HookRoute({
    hook: 'saas.app.storage.updateNode',
    description: 'Storage 节点更新 (改名或移动 parent)',
    args: [idParamInput.shape.id, UpdateStorageNodeSchema],
  })
  async updateNode(
    @Param('id') id: string,
    @Body() body: UpdateStorageNodeRequest,
    @Req() req: AuthedReq,
    context?: HookInvocationContext,
  ) {
    const tenantId = resolveStorageTenantId(req, context);
    const userId = resolveStorageUserId(req, context);
    const node = await this.storageService.updateNode(
      id,
      tenantId,
      userId,
      body,
    );
    return { success: true, data: toStorageNodeResponse(node) };
  }

  /**
   * @title 删除节点
   * @description 软删除节点
   */
  @Delete('nodes/:id')
  @CheckAbility('delete', 'storage')
  @HookRoute({
    hook: 'saas.app.storage.deleteNode',
    description: 'Storage 节点软删除',
    args: [idParamInput.shape.id],
  })
  async deleteNode(
    @Param('id') id: string,
    @Req() req: AuthedReq,
    context?: HookInvocationContext,
  ) {
    const tenantId = resolveStorageTenantId(req, context);
    await this.storageService.deleteNode(id, tenantId);
    return { success: true };
  }

  /**
   * @title 创建分享链接
   * @description 为节点创建分享链接
   */
  @Post('nodes/:id/share')
  @CheckAbility('share', 'storage')
  @HookRoute({
    hook: 'saas.app.storage.createShare',
    description: 'Storage 节点分享链接创建',
    args: [idParamInput.shape.id, CreateShareSchema],
  })
  async createShare(
    @Param('id') id: string,
    @Body() body: CreateShareRequest,
    @Req() req: AuthedReq,
    context?: HookInvocationContext,
  ) {
    const tenantId = resolveStorageTenantId(req, context);
    const share = await this.storageService.createShare(id, tenantId, body);
    return { success: true, data: share };
  }

  /**
   * @title 删除分享链接
   * @description 移除节点的分享链接
   */
  @Delete('nodes/:id/share')
  @CheckAbility('share', 'storage')
  @HookRoute({
    hook: 'saas.app.storage.removeShare',
    description: 'Storage 节点分享链接移除',
    args: [idParamInput.shape.id],
  })
  async removeShare(
    @Param('id') id: string,
    @Req() req: AuthedReq,
    context?: HookInvocationContext,
  ) {
    const tenantId = resolveStorageTenantId(req, context);
    await this.storageService.removeShare(id, tenantId);
    return { success: true };
  }

  /**
   * @title 访问分享内容
   * @description 通过 Token 访问分享的内容（公开接口）
   */
  @Get('share/:token')
  async getShareContent(
    @Param('token') token: string,
    @Query('password') password?: string,
  ) {
    const node = await this.storageService.getShareContent(token, password);
    return { success: true, data: toStorageNodeResponse(node) };
  }
}
