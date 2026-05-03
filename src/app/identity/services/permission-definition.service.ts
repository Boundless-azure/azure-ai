import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { DataPermissionRegistryService } from '@/core/data-permission';
import { PermissionDefinitionEntity } from '../entities/permission-definition.entity';
import { PermissionDefinitionType } from '../enums/permission.enums';
import type {
  CreatePermissionDefinitionDto,
  UpdatePermissionDefinitionDto,
  QueryPermissionDefinitionDto,
} from '../types/identity.types';

/**
 * @title PermissionDefinition 服务
 * @description 权限定义的读取与维护。
 *              启动期把 @DataPermissionNode 装饰器声明的所有数据节点同步到 permission_definitions 表 ::
 *              - 找/建 subject root (fid=null, nodeKey=subject, permissionType=management)
 *              - 找/建 data 子节点 (fid=root.id, nodeKey=action, permissionType=data, weight=装饰器值)
 *              装饰器是 SSOT, db 表只是镜像 + 可视化, 用于前端配置 UI 与越权防护查询。
 * @keywords-cn 权限定义服务, 枚举, 启动同步, 装饰器镜像
 * @keywords-en permission-definition-service, enum, startup-sync, decorator-mirror
 */
@Injectable()
export class PermissionDefinitionService implements OnModuleInit {
  private readonly logger = new Logger(PermissionDefinitionService.name);

  constructor(
    @InjectRepository(PermissionDefinitionEntity)
    private readonly repo: Repository<PermissionDefinitionEntity>,
    @Optional()
    private readonly dataPermissionRegistry?: DataPermissionRegistryService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.dataPermissionRegistry) return;
    try {
      await this.syncFromDecorators();
    } catch (e) {
      // 启动期同步失败不阻塞 :: db 可能未连或迁移未跑, 留 warn 后续可手动重试
      this.logger.warn(
        `[permission-definition] decorator sync skipped: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /**
   * 把 @DataPermissionNode 装饰器声明的所有数据节点 upsert 到 permission_definitions 表
   * @keyword-en sync-from-decorators
   */
  private async syncFromDecorators(): Promise<void> {
    if (!this.dataPermissionRegistry) return;
    const all = this.dataPermissionRegistry.listAll();
    if (all.length === 0) return;

    // 按 subject 分组, 每个 subject 先确保 root 存在再处理 data 子节点
    const subjects = new Set(all.map((r) => r.meta.subject));
    const subjectRootMap = new Map<string, string>(); // subject → rootId

    for (const subject of subjects) {
      const root = await this.ensureSubjectRoot(subject);
      subjectRootMap.set(subject, root.id);
    }

    // upsert 每个 data 节点
    for (const reg of all) {
      const rootId = subjectRootMap.get(reg.meta.subject);
      if (!rootId) continue;
      await this.upsertDataNode(
        rootId,
        reg.meta.action,
        reg.meta.weight ?? 0,
        reg.source.dtoClassName,
      );
    }
    this.logger.log(
      `[permission-definition] synced ${all.length} data nodes across ${subjects.size} subjects from @DataPermissionNode decorators`,
    );
  }

  /**
   * 保证 subject 根节点存在 :: fid=null, nodeKey=subject, permissionType=management (root 默认 management)
   * @keyword-en ensure-subject-root
   */
  private async ensureSubjectRoot(
    subject: string,
  ): Promise<PermissionDefinitionEntity> {
    let root = await this.repo.findOne({
      where: {
        fid: IsNull(),
        nodeKey: subject,
        isDelete: false,
      },
    });
    if (root) return root;
    root = this.repo.create({
      fid: null,
      nodeKey: subject,
      permissionType: PermissionDefinitionType.Management,
      weight: 0,
      description: `Auto-created subject root for data permission decorator scan`,
      isDelete: false,
    });
    return await this.repo.save(root);
  }

  /**
   * upsert 一条 data 类型子节点 :: 已存在则更新 weight, 不存在则插
   * @keyword-en upsert-data-node
   */
  private async upsertDataNode(
    rootId: string,
    action: string,
    weight: number,
    dtoClassName: string,
  ): Promise<void> {
    const existing = await this.repo.findOne({
      where: {
        fid: rootId,
        nodeKey: action,
        permissionType: PermissionDefinitionType.Data,
        isDelete: false,
      },
    });
    if (existing) {
      if (existing.weight !== weight) {
        existing.weight = weight;
        await this.repo.save(existing);
      }
      return;
    }
    const node = this.repo.create({
      fid: rootId,
      nodeKey: action,
      permissionType: PermissionDefinitionType.Data,
      weight,
      description: `Auto-synced from @DataPermissionNode on ${dtoClassName}`,
      isDelete: false,
    });
    await this.repo.save(node);
  }

  /**
   * 列出权限定义 :: 支持按 permissionType / nodeKey / fid 过滤
   * fid 传 null/'null' 仅返回 root 节点 (subject 根); 不传则返回所有 (含 root + 子节点)
   * @keyword-en list-permission-definitions filter-type filter-node filter-parent
   */
  async list(
    query: QueryPermissionDefinitionDto = {},
  ): Promise<PermissionDefinitionEntity[]> {
    const where: Record<string, unknown> = { isDelete: false };
    if (query.permissionType) where['permissionType'] = query.permissionType;
    if (query.nodeKey) where['nodeKey'] = query.nodeKey;
    if (query.fid !== undefined) {
      where['fid'] =
        query.fid === null || query.fid === 'null' ? IsNull() : query.fid;
    }
    return await this.repo.find({
      where,
      order: { permissionType: 'ASC', fid: 'ASC', nodeKey: 'ASC' },
    });
  }

  async create(
    data: CreatePermissionDefinitionDto,
  ): Promise<PermissionDefinitionEntity> {
    const entity = this.repo.create({
      fid: data.fid ?? null,
      nodeKey: data.nodeKey,
      permissionType:
        data.permissionType ?? PermissionDefinitionType.Management,
      description: data.description ?? null,
      extraData: data.extraData ?? null,
      isDelete: false,
    });
    return await this.repo.save(entity);
  }

  async update(id: string, dto: UpdatePermissionDefinitionDto): Promise<void> {
    const entity = await this.repo.findOneBy({ id, isDelete: false });
    if (!entity) return;

    if (dto.fid !== undefined) entity.fid = dto.fid;
    if (dto.nodeKey !== undefined) entity.nodeKey = dto.nodeKey;
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.extraData !== undefined) entity.extraData = dto.extraData;
    if (dto.permissionType !== undefined) {
      entity.permissionType = dto.permissionType;
    }

    await this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    const idsToDelete: string[] = [id];
    let cursor = 0;

    while (cursor < idsToDelete.length) {
      const batch = idsToDelete.slice(cursor, cursor + 100);
      cursor += batch.length;
      const children = await this.repo.find({
        select: ['id'],
        where: { fid: In(batch), isDelete: false },
      });
      for (const child of children) {
        if (!idsToDelete.includes(child.id)) idsToDelete.push(child.id);
      }
    }

    await this.repo.update({ id: In(idsToDelete) }, { isDelete: true });
  }
}
