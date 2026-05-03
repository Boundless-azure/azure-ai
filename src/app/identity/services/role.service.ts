import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { RoleEntity } from '../entities/role.entity';
import { RolePermissionEntity } from '../entities/role-permission.entity';
import { PermissionDefinitionEntity } from '../entities/permission-definition.entity';
import { PermissionDefinitionType } from '../enums/permission.enums';
import { AbilityService } from './ability.service';
import type {
  CreateRoleDto,
  UpdateRoleDto,
  UpsertRolePermissionsDto,
  QueryRoleDto,
} from '../types/identity.types';

/**
 * @title Role 服务
 * @description 提供角色与角色权限的管理。
 *              upsertPermissions 加权重越权防护 :: 操作者在该 subject 上的最高权重必须 ≥ 目标节点 weight,
 *              防止下级管理员配置高权重的权限项 (e.g. 普通管理员摘掉 admin 配的租户隔离节点)。
 * @keywords-cn 角色服务, 权限, 管理, 越权防护, 权重校验
 * @keywords-en role-service, permissions, management, escalation-guard, weight-check
 */
@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly permRepo: Repository<RolePermissionEntity>,
    @InjectRepository(PermissionDefinitionEntity)
    private readonly permDefRepo: Repository<PermissionDefinitionEntity>,
    private readonly abilityService: AbilityService,
  ) {}

  /**
   * 列出角色 :: 支持按 organizationId 过滤 (传 null 字符串 "null" 仅返回系统级)、按 q 模糊匹配 name/code
   * @keyword-en list-roles filter-organization filter-keyword
   */
  async list(query: QueryRoleDto = {}): Promise<RoleEntity[]> {
    const qb = this.roleRepo
      .createQueryBuilder('r')
      .where('r.is_delete = false');
    if (query.organizationId !== undefined) {
      if (query.organizationId === '' || query.organizationId === 'null') {
        qb.andWhere('r.organization_id IS NULL');
      } else {
        qb.andWhere('r.organization_id = :oid', { oid: query.organizationId });
      }
    }
    if (query.q && query.q.trim()) {
      const q = `%${query.q.trim()}%`;
      qb.andWhere('(r.name LIKE :q OR r.code LIKE :q)', { q });
    }
    qb.orderBy('r.created_at', 'DESC');
    return await qb.getMany();
  }

  async create(dto: CreateRoleDto): Promise<RoleEntity> {
    const entity = this.roleRepo.create({
      name: dto.name,
      code: dto.code,
      description: dto.description ?? null,
      organizationId: dto.organizationId ?? null,
      builtin: false,
      isDelete: false,
    });
    return await this.roleRepo.save(entity);
  }

  async update(id: string, dto: UpdateRoleDto): Promise<void> {
    const patch: Partial<RoleEntity> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.description !== undefined) patch.description = dto.description;
    await this.roleRepo.update({ id }, patch);
  }

  async delete(id: string): Promise<void> {
    await this.roleRepo.update({ id }, { isDelete: true });
  }

  async listPermissions(roleId: string): Promise<RolePermissionEntity[]> {
    return await this.permRepo.find({
      where: { roleId, isDelete: false },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * @title 批量替换角色权限 :: 新范式 (含 permission_type + 权重越权防护)
   * @description operator 必传, 用于校验越权:
   *              - 收集 dto.items 涉及的所有 (subject, action) 的目标节点 weight
   *              - 对每个 subject 计算操作者 maxWeight, 必须 ≥ 该 subject 下目标 weight 的最大值
   *              - 不通过 → ForbiddenException, 全量入参作废 (避免部分写入)
   *              - 通过 → 软删旧权限 + 批量插新 (replace 语义保持不变)
   * @keyword-en upsert-permissions-with-weight-guard
   */
  async upsertPermissions(
    roleId: string,
    dto: UpsertRolePermissionsDto,
    operatorId?: string,
  ): Promise<{ count: number }> {
    // 1) 越权防护 :: operator 不传时跳过 (兼容内部 seed 调用), 否则强校验
    if (operatorId) {
      await this.guardWeightEscalation(operatorId, dto);
    }

    // 2) 软删旧权限 + 批量插新 (replace 语义)
    await this.permRepo.update({ roleId }, { isDelete: true });
    const entities = dto.items.map((it) =>
      this.permRepo.create({
        roleId,
        subject: it.subject,
        action: it.action,
        permissionType: it.permissionType ?? PermissionDefinitionType.Management,
      }),
    );
    const saved = await this.permRepo.save(entities);
    return { count: saved.length };
  }

  /**
   * 权重越权防护 :: 按 subject 分组, 校验操作者每个 subject 上的 maxWeight ≥ 目标 weight 最大值
   * @keyword-en guard-weight-escalation
   */
  private async guardWeightEscalation(
    operatorId: string,
    dto: UpsertRolePermissionsDto,
  ): Promise<void> {
    // 按 subject 分组要校验的 (subject -> actions[])
    const subjectActionMap = new Map<string, Set<string>>();
    for (const it of dto.items) {
      const set = subjectActionMap.get(it.subject) ?? new Set();
      set.add(it.action);
      subjectActionMap.set(it.subject, set);
    }
    if (subjectActionMap.size === 0) return;

    // 拉取所有涉及 subject 的目标节点 weight
    const subjects = [...subjectActionMap.keys()];
    const subjectRoots = await this.permDefRepo.find({
      where: {
        fid: IsNull(),
        nodeKey: In(subjects),
        isDelete: false,
      },
    });
    const rootIdMap = new Map<string, string>(); // subject -> rootId
    for (const r of subjectRoots) rootIdMap.set(r.nodeKey, r.id);

    for (const [subject, actionSet] of subjectActionMap.entries()) {
      const rootId = rootIdMap.get(subject);
      if (!rootId) {
        // 没有 root 定义 :: weight=0 直通 (PermissionDefinition 同步会自动建立 root, 这里是兜底)
        continue;
      }
      const childNodes = await this.permDefRepo.find({
        where: {
          fid: rootId,
          nodeKey: In([...actionSet]),
          isDelete: false,
        },
      });
      const targetMaxWeight = Math.max(
        0,
        ...childNodes.map((n) => n.weight ?? 0),
      );
      if (targetMaxWeight === 0) continue; // weight=0 不需要防护

      const opMaxWeight = await this.abilityService.getMaxWeight(
        operatorId,
        subject,
      );
      if (opMaxWeight < targetMaxWeight) {
        throw new ForbiddenException(
          `权重越权拒绝 :: 在 subject="${subject}" 上, 你的最高权重 ${opMaxWeight} 低于目标 ${targetMaxWeight}`,
        );
      }
    }
  }
}
