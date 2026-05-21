import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { uuidv7 } from 'uuidv7';
import * as crypto from 'crypto';
import {
  StorageNodeEntity,
  StorageNodeType,
  ShareMode,
} from '../entities/storage-node.entity';
import { ResourceService } from '../../resource/services/resource.service';
import {
  CreateStorageNodeRequest,
  UpdateStorageNodeRequest,
  CreateShareRequest,
  ListStorageNodesQuery,
  ShareLinkResponse,
} from '../types/storage.types';

/**
 * @title Storage Service
 * @description 资源库存储服务，提供目录/文件管理和分享功能，支持删除时检查物理文件引用
 * @keywords-cn 存储服务, 资源库, 目录管理, 分享链接, MD5引用检查
 * @keywords-en storage-service, resource-library, directory-management, share-link, md5-ref-check
 */
@Injectable()
export class StorageService {
  constructor(
    @InjectRepository(StorageNodeEntity)
    private readonly nodeRepo: Repository<StorageNodeEntity>,
    private readonly resourceService: ResourceService,
  ) {}

  /**
   * @title 创建存储节点
   * @description 创建文件夹或文件节点
   * @param tenantId 租户 ID
   * @param userId 创建用户 ID
   * @param data 创建数据
   */
  async createNode(
    tenantId: string,
    userId: string,
    data: CreateStorageNodeRequest,
  ): Promise<StorageNodeEntity> {
    const parent = await this.resolveFolderByPath(
      tenantId,
      data.parentPath ?? '/',
    );
    const parentId = parent?.id ?? null;
    const path = this.joinStoragePath(parent?.path ?? '/', data.name);

    // 检查同名节点是否存在
    const qb = this.nodeRepo
      .createQueryBuilder('node')
      .where('node.tenantId = :tenantId', { tenantId })
      .andWhere('node.name = :name', { name: data.name })
      .andWhere('node.isDelete = :isDelete', { isDelete: false });

    if (parentId) {
      qb.andWhere('node.parentId = :parentId', { parentId });
    } else {
      qb.andWhere('node.parentId IS NULL');
    }

    const existing = await qb.getOne();
    if (existing) {
      throw new BadRequestException(
        'A node with the same name already exists in this location',
      );
    }

    const node = this.nodeRepo.create({
      id: uuidv7(),
      tenantId,
      parentId,
      name: data.name,
      type: data.type,
      path,
      size: data.size?.toString() ?? null,
      mimeType: data.mimeType ?? null,
      resourceId: data.resourceId ?? null,
      shareMode: ShareMode.NONE,
      createdUser: userId,
      updateUser: userId,
      channelId: tenantId,
    });

    return await this.nodeRepo.save(node);
  }

  /**
   * @title 获取节点详情
   * @description 根据 ID 获取节点详情
   * @param id 节点 ID
   * @param tenantId 租户 ID（用于校验）
   */
  async getNode(id: string, tenantId: string): Promise<StorageNodeEntity> {
    const node = await this.nodeRepo.findOne({
      where: { id, tenantId, isDelete: false },
    });
    if (!node) {
      throw new NotFoundException('Node not found');
    }
    return node;
  }

  /**
   * @title 获取子节点列表
   * @description 获取指定父节点下的所有子节点
   * @param tenantId 租户 ID
   * @param query 查询参数
   */
  async listNodes(
    tenantId: string,
    query: ListStorageNodesQuery,
  ): Promise<StorageNodeEntity[]> {
    const parentId = await this.resolveListParentId(tenantId, query);
    const qb = this.nodeRepo
      .createQueryBuilder('node')
      .where('node.tenantId = :tenantId', { tenantId })
      .andWhere('node.isDelete = :isDelete', { isDelete: false });

    if (parentId === null) {
      qb.andWhere('node.parentId IS NULL');
    } else if (parentId !== undefined) {
      qb.andWhere('node.parentId = :parentId', { parentId });
    }

    if (query.type) {
      qb.andWhere('node.type = :type', { type: query.type });
    }

    if (query.q) {
      qb.andWhere('node.name LIKE :q', { q: `%${query.q}%` });
    }

    qb.orderBy('node.type', 'ASC').addOrderBy('node.name', 'ASC');

    return await qb.getMany();
  }

  /**
   * @title 解析列表父目录
   * @description listNodes 按 path 定位目录; path="/" 表示根目录, 未传 path 时默认根目录。
   * @keyword-en resolve-list-parent-id-by-path
   */
  private async resolveListParentId(
    tenantId: string,
    query: ListStorageNodesQuery,
  ): Promise<string | null | undefined> {
    const normalizedPath = this.normalizeStoragePath(query.path ?? '/');
    if (normalizedPath === '/') return null;
    const parent = await this.resolveFolderByPath(tenantId, normalizedPath);
    if (!parent) return null;
    return parent.id;
  }

  /**
   * @title 按路径解析目录
   * @description path="/" 返回 null; 其他路径必须命中当前租户未删除 folder。
   * @keyword-en resolve-folder-by-path
   */
  private async resolveFolderByPath(
    tenantId: string,
    pathValue: string,
  ): Promise<StorageNodeEntity | null> {
    const normalizedPath = this.normalizeStoragePath(pathValue);
    if (normalizedPath === '/') return null;
    const folder = await this.nodeRepo.findOne({
      where: {
        tenantId,
        path: normalizedPath,
        type: StorageNodeType.FOLDER,
        isDelete: false,
      },
    });
    if (!folder) {
      throw new NotFoundException(`Folder path not found: ${normalizedPath}`);
    }
    return folder;
  }

  /**
   * @title 规范化存储路径
   * @description 把 workspace / /workspace/ 统一成 /workspace, 空值和 / 统一成根路径 /。
   * @keyword-en normalize-storage-path
   */
  private normalizeStoragePath(pathValue: string): string {
    const trimmed = pathValue.trim();
    if (!trimmed || trimmed === '/') return '/';
    const withPrefix = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return withPrefix.replace(/\/+$/g, '') || '/';
  }

  /**
   * @title 拼接存储路径
   * @description 用父目录 path 和节点名生成节点完整 path。
   * @keyword-en join-storage-path
   */
  private joinStoragePath(parentPath: string, name: string): string {
    const normalizedParent = this.normalizeStoragePath(parentPath);
    return normalizedParent === '/'
      ? `/${name}`
      : `${normalizedParent}/${name}`;
  }

  /**
   * @title 获取根目录节点
   * @description 获取租户的根目录节点列表
   * @param tenantId 租户 ID
   */
  async getRootNodes(tenantId: string): Promise<StorageNodeEntity[]> {
    return await this.nodeRepo.find({
      where: { tenantId, parentId: IsNull(), isDelete: false },
      order: { type: 'ASC', name: 'ASC' },
    });
  }

  /**
   * @title 更新节点
   * @description 更新节点名称或移动节点位置
   * @param id 节点 ID
   * @param tenantId 租户 ID
   * @param userId 用户 ID
   * @param data 更新数据
   */
  async updateNode(
    id: string,
    tenantId: string,
    userId: string,
    data: UpdateStorageNodeRequest,
  ): Promise<StorageNodeEntity> {
    const node = await this.getNode(id, tenantId);
    const oldPath = node.path;
    const moving = data.parentPath !== undefined;
    const targetParent = moving
      ? await this.resolveFolderByPath(tenantId, data.parentPath ?? '/')
      : node.parentId
        ? await this.nodeRepo.findOne({ where: { id: node.parentId } })
        : null;
    const targetParentId = targetParent?.id ?? null;
    const nextName = data.name ?? node.name;

    if (
      node.type === StorageNodeType.FOLDER &&
      targetParent &&
      (targetParent.id === node.id ||
        targetParent.path.startsWith(`${node.path}/`))
    ) {
      throw new BadRequestException('Cannot move folder into itself');
    }

    if (data.name !== undefined || (moving && targetParentId !== node.parentId)) {
      // 检查同名节点
      const qb = this.nodeRepo
        .createQueryBuilder('node')
        .where('node.tenantId = :tenantId', { tenantId })
        .andWhere('node.name = :name', { name: nextName })
        .andWhere('node.isDelete = :isDelete', { isDelete: false })
        .andWhere('node.id != :id', { id });

      if (targetParentId === null) {
        qb.andWhere('node.parentId IS NULL');
      } else {
        qb.andWhere('node.parentId = :parentId', { parentId: targetParentId });
      }

      const existing = await qb.getOne();
      if (existing) {
        throw new BadRequestException(
          'A node with the same name already exists',
        );
      }
      node.name = nextName;
      node.parentId = targetParentId;
      node.path = this.joinStoragePath(targetParent?.path ?? '/', nextName);
    }

    node.updateUser = userId;
    const saved = await this.nodeRepo.save(node);
    if (saved.type === StorageNodeType.FOLDER && oldPath !== saved.path) {
      await this.updateDescendantPaths(
        tenantId,
        saved.id,
        oldPath,
        saved.path,
        userId,
      );
    }
    return saved;
  }

  /**
   * @title 同步子孙路径
   * @description 文件夹改名或移动后, 将所有子孙节点 path 从旧前缀替换为新前缀。
   * @keyword-en update-descendant-paths
   */
  private async updateDescendantPaths(
    tenantId: string,
    folderId: string,
    oldPath: string,
    newPath: string,
    userId: string,
  ): Promise<void> {
    const descendants = await this.nodeRepo
      .createQueryBuilder('node')
      .where('node.tenantId = :tenantId', { tenantId })
      .andWhere('node.isDelete = :isDelete', { isDelete: false })
      .andWhere('node.id != :folderId', { folderId })
      .andWhere('node.path LIKE :prefix', { prefix: `${oldPath}/%` })
      .getMany();

    for (const child of descendants) {
      child.path = `${newPath}${child.path.slice(oldPath.length)}`;
      child.updateUser = userId;
    }
    if (descendants.length > 0) {
      await this.nodeRepo.save(descendants);
    }
  }

  /**
   * @title 删除节点
   * @description 软删除节点，文件节点同步调用 resourceService 删除关联资源
   * @keyword-en delete-node, soft-delete
   * @param id 节点 ID
   * @param tenantId 租户 ID
   */
  async deleteNode(id: string, tenantId: string): Promise<void> {
    const node = await this.getNode(id, tenantId);

    if (node.type === StorageNodeType.FOLDER) {
      await this.deleteChildren(node.id, tenantId);
    } else if (node.resourceId) {
      await this.resourceService.deleteById(node.resourceId);
    }

    node.isDelete = true;
    node.deletedAt = new Date();
    await this.nodeRepo.save(node);
  }

  private async deleteChildren(
    parentId: string,
    tenantId: string,
  ): Promise<void> {
    const children = await this.nodeRepo.find({
      where: { parentId, tenantId, isDelete: false },
    });

    for (const child of children) {
      if (child.type === StorageNodeType.FOLDER) {
        await this.deleteChildren(child.id, tenantId);
      } else if (child.resourceId) {
        await this.resourceService.deleteById(child.resourceId);
      }
      child.isDelete = true;
      child.deletedAt = new Date();
      await this.nodeRepo.save(child);
    }
  }

  /**
   * @title 创建分享链接
   * @description 为节点创建分享链接
   * @param id 节点 ID
   * @param tenantId 租户 ID
   * @param data 分享配置
   */
  async createShare(
    id: string,
    tenantId: string,
    data: CreateShareRequest,
  ): Promise<ShareLinkResponse> {
    const node = await this.getNode(id, tenantId);

    // 生成 Token
    const token = crypto.randomBytes(32).toString('hex');

    // 处理密码
    let encryptedPassword: string | null = null;
    if (data.mode === ShareMode.PASSWORD && data.password) {
      encryptedPassword = crypto
        .createHash('sha256')
        .update(data.password)
        .digest('hex');
    }

    // 处理过期时间
    let expiresAt: Date | null = null;
    if (data.mode === ShareMode.TEMP && data.expiresIn) {
      expiresAt = new Date(Date.now() + data.expiresIn * 1000);
    }

    node.shareMode = data.mode;
    node.sharePassword = encryptedPassword;
    node.shareExpiresAt = expiresAt;
    node.shareToken = token;
    await this.nodeRepo.save(node);

    return {
      token,
      url: `/storage/share/${token}`,
      expiresAt,
      passwordRequired: data.mode === ShareMode.PASSWORD,
    };
  }

  /**
   * @title 获取分享内容
   * @description 通过 Token 获取分享的节点内容
   * @param token 分享 Token
   * @param password 密码（如果有）
   */
  async getShareContent(
    token: string,
    password?: string,
  ): Promise<StorageNodeEntity> {
    const node = await this.nodeRepo.findOne({
      where: { shareToken: token, isDelete: false },
    });

    if (!node) {
      throw new NotFoundException('Share link not found or expired');
    }

    if (node.shareMode === ShareMode.NONE) {
      throw new NotFoundException('This node is not shared');
    }

    // 检查过期
    if (node.shareExpiresAt && new Date() > node.shareExpiresAt) {
      throw new NotFoundException('Share link has expired');
    }

    // 检查密码
    if (node.shareMode === ShareMode.PASSWORD) {
      if (!password) {
        throw new BadRequestException('Password is required');
      }
      const hashedPassword = crypto
        .createHash('sha256')
        .update(password)
        .digest('hex');
      if (hashedPassword !== node.sharePassword) {
        throw new BadRequestException('Invalid password');
      }
    }

    return node;
  }

  /**
   * @title 删除分享链接
   * @description 移除节点的分享链接
   * @param id 节点 ID
   * @param tenantId 租户 ID
   */
  async removeShare(id: string, tenantId: string): Promise<void> {
    const node = await this.getNode(id, tenantId);
    node.shareMode = ShareMode.NONE;
    node.sharePassword = null;
    node.shareExpiresAt = null;
    node.shareToken = null;
    await this.nodeRepo.save(node);
  }

  /**
   * 生成复制后的文件名（插入 " (copy)" 或 " - 副本"）
   * @keyword-en generate-copy-name, filename-copy
   */
  private generateCopyName(name: string): string {
    // 简单判断是否含中文：含中文则用 " - 副本"，否则用 " (copy)"
    const hasChinese = /[\u4e00-\u9fa5]/.test(name);
    if (hasChinese) {
      return `${name} - 副本`;
    }
    // 尝试在扩展名前插入
    const lastDot = name.lastIndexOf('.');
    if (lastDot > 0) {
      return `${name.slice(0, lastDot)} (copy)${name.slice(lastDot)}`;
    }
    return `${name} (copy)`;
  }

  /**
   * 复制节点（支持文件和文件夹递归复制）
   * @keyword-en copy-nodes, recursive-copy
   * @param nodeIds 要复制的节点 ID 列表
   * @param targetPath 目标目录路径
   * @param tenantId 租户 ID
   * @param userId操作用户 ID
   * @param duplicateResource 复制资源的函数（由 Controller 注入 ResourceService）
   */
  async copyNodes(
    nodeIds: string[],
    targetPath: string,
    tenantId: string,
    userId: string,
    duplicateResource: (resourceId: string) => Promise<string>,
  ): Promise<StorageNodeEntity[]> {
    const results: StorageNodeEntity[] = [];
    const targetFolder = await this.resolveFolderByPath(tenantId, targetPath);
    const targetFolderPath = targetFolder?.path ?? '/';

    for (const nodeId of nodeIds) {
      const source = await this.nodeRepo.findOne({
        where: { id: nodeId, isDelete: false },
      });
      if (!source) continue;

      if (source.type === StorageNodeType.FILE) {
        // 文件：复制资源 + 创建节点
        const newResourceId = source.resourceId
          ? await duplicateResource(source.resourceId)
          : null;
        const newName = this.generateCopyName(source.name);
        const newNode = await this.createNode(tenantId, userId, {
          name: newName,
          type: StorageNodeType.FILE,
          parentPath: targetFolderPath,
          resourceId: newResourceId,
          size: source.size ? parseInt(source.size, 10) : null,
          mimeType: source.mimeType,
        });
        results.push(newNode);
      } else {
        // 文件夹：递归复制
        const newFolderName = this.generateCopyName(source.name);
        const newFolder = await this.createNode(tenantId, userId, {
          name: newFolderName,
          type: StorageNodeType.FOLDER,
          parentPath: targetFolderPath,
        });
        results.push(newFolder);

        // 递归复制子节点
        const children = await this.nodeRepo.find({
          where: { parentId: source.id, isDelete: false },
        });
        if (children.length > 0) {
          const copied = await this.copyNodes(
            children.map((c) => c.id),
            newFolder.path,
            tenantId,
            userId,
            duplicateResource,
          );
          results.push(...copied);
        }
      }
    }

    return results;
  }
}
