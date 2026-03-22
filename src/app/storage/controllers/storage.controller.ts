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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Request } from 'express';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { StorageService } from '../services/storage.service';
import { ResourceService } from '../../resource/services/resource.service';
import {
  CreateStorageNodeRequest,
  UpdateStorageNodeRequest,
  CreateShareRequest,
  ListStorageNodesQuery,
  StorageNodeType,
  CopyNodesRequest,
} from '../types/storage.types';

type AuthedReq = Request & { user?: { id?: string; tenantId?: string } };

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
 * @title Storage Controller
 * @description 资源库存储控制器，提供目录/文件管理和分享 API
 * @keywords-cn 存储控制器, 资源库, 文件管理, 分享
 * @keywords-en storage-controller, resource-library, file-management, share
 */
@Controller('storage')
export class StorageController {
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
  async createNode(
    @Body() body: CreateStorageNodeRequest,
    @Req() req: AuthedReq,
  ) {
    const tenantId = req.user?.tenantId ?? req.user?.id ?? 'default';
    const userId = req.user?.id ?? 'system';
    const node = await this.storageService.createNode(tenantId, userId, body);
    return { success: true, data: node };
  }

  /**
   * @title 复制节点
   * @description 复制文件或文件夹（支持递归），自动重命名为 "xxx (copy)"
   */
  @Post('nodes/copy')
  @CheckAbility('create', 'storage')
  async copyNodes(@Body() body: CopyNodesRequest, @Req() req: AuthedReq) {
    const tenantId = req.user?.tenantId ?? req.user?.id ?? 'default';
    const userId = req.user?.id ?? 'system';

    const nodes = await this.storageService.copyNodes(
      body.nodeIds,
      body.targetParentId,
      tenantId,
      userId,
      async (resourceId: string) => {
        return await this.resourceService.duplicate(resourceId, userId);
      },
    );

    return { success: true, data: nodes };
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
    @Body('parentId') parentId: string | null,
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
      parentId: parentId ?? null,
      resourceId: resource.id,
      size: file.size,
      mimeType: file.mimetype,
    });

    return { success: true, data: node };
  }

  /**
   * @title 获取节点列表
   * @description 获取指定父节点下的所有子节点
   */
  @Get('nodes')
  @CheckAbility('read', 'storage')
  async listNodes(
    @Query() query: ListStorageNodesQuery,
    @Req() req: AuthedReq,
  ) {
    const tenantId = req.user?.tenantId ?? req.user?.id ?? 'default';
    const nodes = await this.storageService.listNodes(tenantId, query);
    return { success: true, data: nodes };
  }

  /**
   * @title 获取根目录
   * @description 获取租户的根目录节点列表
   */
  @Get('nodes/root')
  @CheckAbility('read', 'storage')
  async getRootNodes(@Req() req: AuthedReq) {
    const tenantId = req.user?.tenantId ?? req.user?.id ?? 'default';
    const nodes = await this.storageService.getRootNodes(tenantId);
    return { success: true, data: nodes };
  }

  /**
   * @title 获取节点详情
   * @description 根据 ID 获取节点详情
   */
  @Get('nodes/:id')
  @CheckAbility('read', 'storage')
  async getNode(@Param('id') id: string, @Req() req: AuthedReq) {
    const tenantId = req.user?.tenantId ?? req.user?.id ?? 'default';
    const node = await this.storageService.getNode(id, tenantId);
    return { success: true, data: node };
  }

  /**
   * @title 更新节点
   * @description 更新节点名称或移动节点位置
   */
  @Put('nodes/:id')
  @CheckAbility('update', 'storage')
  async updateNode(
    @Param('id') id: string,
    @Body() body: UpdateStorageNodeRequest,
    @Req() req: AuthedReq,
  ) {
    const tenantId = req.user?.tenantId ?? req.user?.id ?? 'default';
    const userId = req.user?.id ?? 'system';
    const node = await this.storageService.updateNode(
      id,
      tenantId,
      userId,
      body,
    );
    return { success: true, data: node };
  }

  /**
   * @title 删除节点
   * @description 软删除节点
   */
  @Delete('nodes/:id')
  @CheckAbility('delete', 'storage')
  async deleteNode(@Param('id') id: string, @Req() req: AuthedReq) {
    const tenantId = req.user?.tenantId ?? req.user?.id ?? 'default';
    await this.storageService.deleteNode(id, tenantId);
    return { success: true };
  }

  /**
   * @title 创建分享链接
   * @description 为节点创建分享链接
   */
  @Post('nodes/:id/share')
  @CheckAbility('share', 'storage')
  async createShare(
    @Param('id') id: string,
    @Body() body: CreateShareRequest,
    @Req() req: AuthedReq,
  ) {
    const tenantId = req.user?.tenantId ?? req.user?.id ?? 'default';
    const share = await this.storageService.createShare(id, tenantId, body);
    return { success: true, data: share };
  }

  /**
   * @title 删除分享链接
   * @description 移除节点的分享链接
   */
  @Delete('nodes/:id/share')
  @CheckAbility('share', 'storage')
  async removeShare(@Param('id') id: string, @Req() req: AuthedReq) {
    const tenantId = req.user?.tenantId ?? req.user?.id ?? 'default';
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
    return { success: true, data: node };
  }
}
