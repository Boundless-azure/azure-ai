import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
  private readonly logger = new Logger(RoleService.name);

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
   * 取角色或抛 NotFoundException; 内部 helper, 集中"按 id 取角色"逻辑
   *  - 入参原样保留 (含尾空格), 便于 LLM 看到自己传错的 id
   *  - this.logger 由 HookAwareLogger 全局替换, 自动 fan-out 到当前 hook 调用的 OTel SpanEvent (debug=true 时进 result.debugLog)
   * @keyword-en get-role-or-throw require-role
   */
  private async requireRole(id: string): Promise<RoleEntity> {
    this.logger.debug(`requireRole:start id=${JSON.stringify(id)}`);
    const role = await this.roleRepo.findOne({
      where: { id, isDelete: false },
    });
    if (!role) {
      this.logger.warn(
        `requireRole:not-found id=${JSON.stringify(id)} hint=请调 saas.app.identity.roleList 先拿合法 id (角色 id 是 UUID 字符串)`,
      );
      throw new NotFoundException(
        `Role not found :: id=${JSON.stringify(id)} (角色不存在或已删除, 请用 saas.app.identity.roleList 先确认 id)`,
      );
    }
    this.logger.debug(
      `requireRole:hit id=${id} name="${role.name}" code="${role.code}"`,
    );
    return role;
  }

  /**
   * 列出角色 :: 支持按 organizationId 过滤 (传 null 字符串 "null" 仅返回系统级)、按 q 模糊匹配 name/code
   * @keyword-en list-roles filter-organization filter-keyword
   */
  async list(query: QueryRoleDto = {}): Promise<RoleEntity[]> {
    this.logger.log(`[list:start] payload=${JSON.stringify(query)}`);
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
    const items = await qb.getMany();
    this.logger.log(
      `[list] q=${query.q ?? ''} org=${query.organizationId ?? ''} → ${items.length} records`,
    );
    return items;
  }

  /**
   * 统计角色总数，支持按 organizationId 过滤。
   * @keyword-cn 角色总数, 统计
   * @keyword-en count-roles, role-count
   */
  async count(query: { organizationId?: string } = {}): Promise<{ count: number }> {
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
    const count = await qb.getCount();
    return { count };
  }

  async create(dto: CreateRoleDto): Promise<RoleEntity> {
    this.logger.log(`[create:start] payload=${JSON.stringify(dto)}`);
    const entity = this.roleRepo.create({
      name: dto.name,
      code: dto.code,
      description: dto.description ?? null,
      organizationId: dto.organizationId ?? null,
      builtin: false,
      isDelete: false,
    });
    const saved = await this.roleRepo.save(entity);
    this.logger.log(
      `[create] id=${saved.id} name="${dto.name}" code="${dto.code}" org=${dto.organizationId ?? 'null'}`,
    );
    return saved;
  }

  async update(id: string, dto: UpdateRoleDto): Promise<void> {
    this.logger.log(
      `[update:start] id=${JSON.stringify(id)} payload=${JSON.stringify(dto)}`,
    );
    await this.requireRole(id);
    const patch: Partial<RoleEntity> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.description !== undefined) patch.description = dto.description;
    await this.roleRepo.update({ id }, patch);
    this.logger.log(
      `[update] id=${id} fields=[${Object.keys(patch).join(',')}]`,
    );
  }

  async delete(id: string): Promise<void> {
    this.logger.log(`[delete:start] id=${JSON.stringify(id)}`);
    await this.requireRole(id);
    await this.roleRepo.update({ id }, { isDelete: true });
    this.logger.log(`[delete] id=${id} (soft)`);
  }

  async listPermissions(roleId: string): Promise<RolePermissionEntity[]> {
    this.logger.log(`[listPermissions:start] roleId=${JSON.stringify(roleId)}`);
    await this.requireRole(roleId);
    const items = await this.permRepo.find({
      where: { roleId, isDelete: false },
      order: { createdAt: 'DESC' },
    });
    this.logger.log(
      `[listPermissions] roleId=${roleId} → ${items.length} permissions`,
    );
    return items;
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
    this.logger.log(
      `[upsertPermissions:start] roleId=${JSON.stringify(roleId)} operator=${operatorId ?? 'system'} payload=${JSON.stringify(dto)}`,
    );
    await this.requireRole(roleId);

    // 1) 越权防护 :: operator 不传时跳过 (兼容内部 seed 调用), 否则强校验
    if (operatorId) {
      this.logger.debug(
        `[upsertPermissions:weight-guard:start] roleId=${roleId} operator=${operatorId} items=${dto.items.length}`,
      );
      await this.guardWeightEscalation(operatorId, dto);
      this.logger.debug(
        `[upsertPermissions:weight-guard:passed] roleId=${roleId}`,
      );
    }

    // 2) 软删旧权限 + 批量插新 (replace 语义)
    await this.permRepo.update({ roleId }, { isDelete: true });
    const entities = dto.items.map((it) =>
      this.permRepo.create({
        roleId,
        subject: it.subject,
        action: it.action,
        permissionType:
          it.permissionType ?? PermissionDefinitionType.Management,
      }),
    );
    const saved = await this.permRepo.save(entities);
    this.logger.log(
      `[upsertPermissions] roleId=${roleId} operator=${operatorId ?? 'system'} replaced→${saved.length} items`,
    );
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
