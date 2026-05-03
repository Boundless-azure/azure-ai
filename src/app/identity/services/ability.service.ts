import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { RolePermissionEntity } from '../entities/role-permission.entity';
import { MembershipEntity } from '../entities/membership.entity';
import { RoleEntity } from '../entities/role.entity';
import { PermissionDefinitionEntity } from '../entities/permission-definition.entity';
import { PermissionDefinitionType } from '../enums/permission.enums';

/**
 * @title Ability Service (CASL兼容设计)
 * @description 提供基于角色权限的能力检查，接口与 CASL 习惯对齐：can/cannot。
 * @keywords-cn 权限能力, CASL, can, cannot
 * @keywords-en ability, casl, can, cannot
 */
@Injectable()
export class AbilityService {
  constructor(
    @InjectRepository(RolePermissionEntity)
    private readonly permRepo: Repository<RolePermissionEntity>,
    @InjectRepository(MembershipEntity)
    private readonly membershipRepo: Repository<MembershipEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(PermissionDefinitionEntity)
    private readonly permDefRepo: Repository<PermissionDefinitionEntity>,
  ) {}

  // ==========================================================================
  // 新范式辅助方法 :: 给 data-permission ContextService / role.controller 越权防护用
  // ==========================================================================

  /**
   * 拿 principal 名下所有 roleId :: memberships → roles
   * @keyword-en list-role-ids
   */
  private async listRoleIdsByPrincipal(principalId: string): Promise<string[]> {
    const memberships = await this.membershipRepo.find({
      where: { principalId, isDelete: false },
    });
    const ids = new Set<string>();
    for (const m of memberships) {
      const id = m.roleId;
      if (typeof id === 'string' && id.trim().length > 0) ids.add(id);
    }
    return Array.from(ids);
  }

  /**
   * 拿 principal 在指定权限类型下的 (subject, action) 列表
   * 给 DataPermissionContextService.build() 用 :: ctx.dataPermissions / managementPermissions 由此填充
   * @keyword-en list-perms-by-type
   */
  async listPermissionsByType(
    principalId: string,
    permissionType: PermissionDefinitionType,
  ): Promise<Array<{ subject: string; action: string }>> {
    const roleIds = await this.listRoleIdsByPrincipal(principalId);
    if (roleIds.length === 0) return [];
    const items = await this.permRepo.find({
      where: {
        roleId: In(roleIds),
        permissionType,
        isDelete: false,
      },
    });
    // 去重 :: 多角色可能配同一条 (subject, action), 只返回唯一对
    const seen = new Set<string>();
    const result: Array<{ subject: string; action: string }> = [];
    for (const it of items) {
      const key = `${it.subject}::${it.action}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ subject: it.subject, action: it.action });
    }
    return result;
  }

  /**
   * 计算操作者在指定 subject 上的最高权重 :: 给 role.controller 越权防护用
   *
   * 算法:
   * 1. 通配优先 :: 操作者拥有 (subject='*') 或 (subject 同 AND action='*') → 视为 MAX_INT
   * 2. fallback :: 操作者持有的所有 (subject 匹配) RolePermission 通过 fid 链关联到 PermissionDefinition,
   *    取 max(weight)
   * @keyword-en get-max-weight
   */
  async getMaxWeight(operatorId: string, subject: string): Promise<number> {
    const roleIds = await this.listRoleIdsByPrincipal(operatorId);
    if (roleIds.length === 0) return 0;

    const allPerms = await this.permRepo.find({
      where: { roleId: In(roleIds), isDelete: false },
    });

    // 1) 通配检查
    const wildcard = allPerms.some(
      (p) =>
        p.subject === '*' ||
        (p.subject === subject && p.action === '*') ||
        (p.subject === '*' && p.action === '*'),
    );
    if (wildcard) return Number.MAX_SAFE_INTEGER;

    // 2) 找 subject root :: fid=null AND nodeKey=subject
    const subjectRoot = await this.permDefRepo.findOne({
      where: { fid: IsNull(), nodeKey: subject, isDelete: false },
    });
    if (!subjectRoot) return 0;

    // 3) 操作者持有的 (subject 同) action 列表
    const actions = allPerms
      .filter((p) => p.subject === subject)
      .map((p) => p.action);
    if (actions.length === 0) return 0;

    // 4) 关联 PermissionDefinition 拿 max weight
    const childNodes = await this.permDefRepo.find({
      where: {
        fid: subjectRoot.id,
        nodeKey: In(actions),
        isDelete: false,
      },
    });
    return Math.max(0, ...childNodes.map((n) => n.weight ?? 0));
  }

  /**
   * @title 计算能力
   * @description 根据角色ID列表合并权限，返回 can/cannot 接口。
   */
  async buildForRoles(roleIds: string[]): Promise<{
    can: (
      action: string,
      subject: string,
      _ctx?: Record<string, unknown>,
    ) => boolean;
    cannot: (
      action: string,
      subject: string,
      _ctx?: Record<string, unknown>,
    ) => boolean;
    rules: Array<{
      subject: string;
      action: string;
    }>;
  }> {
    // 仅取 management 类型权限 :: data / menu 类型由各自链路处理 (data 走 applyTo, menu 走前端路由守卫)
    const items = await this.permRepo.find({
      where: roleIds.length
        ? {
            roleId: In(roleIds),
            permissionType: PermissionDefinitionType.Management,
          }
        : {
            isDelete: false,
            permissionType: PermissionDefinitionType.Management,
          },
    });
    const rules = items.map((r) => ({
      subject: r.subject,
      action: r.action,
    }));

    const can = (action: string, subject: string) => {
      return rules.some((r) => {
        // 支持 manage/* 通配 :: action='manage' 或 '*' 表示任意动作; subject='*' 表示任意资源
        const actionMatch =
          r.action === action || r.action === 'manage' || r.action === '*';
        const subjectMatch = r.subject === subject || r.subject === '*';
        return actionMatch && subjectMatch;
      });
    };

    const cannot = (action: string, subject: string) => !can(action, subject);

    return { can, cannot, rules };
  }

  /**
   * @title 按主体计算能力
   * @description 根据主体在组织中的成员角色（owner/admin/member）生成基础权限规则，并返回 can/cannot 接口。
   * @keywords-cn 主体能力, 成员角色, 读取线程
   * @keywords-en principal-ability, membership-role, read-thread
   */
  async buildForPrincipal(principalId: string): Promise<{
    can: (
      action: string,
      subject: string,
      _ctx?: Record<string, unknown>,
    ) => boolean;
    cannot: (
      action: string,
      subject: string,
      _ctx?: Record<string, unknown>,
    ) => boolean;
    rules: Array<{
      subject: string;
      action: string;
    }>;
  }> {
    const isNonEmptyString = (val: unknown): val is string =>
      typeof val === 'string' && val.trim().length > 0;

    const memberships = await this.membershipRepo.find({
      where: { principalId, isDelete: false },
    });
    const roleIds: string[] = [];
    for (const m of memberships) {
      const id = m.roleId;
      if (isNonEmptyString(id)) roleIds.push(id);
    }
    const roles = roleIds.length
      ? await this.roleRepo.find({ where: { id: In(roleIds) } })
      : [];
    const isAdminLike = roles.some((r) => r.code === 'admin' || r.builtin);

    // 行级 conditions 已迁移到 data-permission 节点处理, 这里 baseRules 只保留通配 / 默认放行规则
    const baseRules: Array<{
      subject: string;
      action: string;
    }> = [];

    if (isAdminLike) {
      baseRules.push({ subject: '*', action: '*' });
    }
    // 非 admin 默认无额外 baseRules :: 完全靠 RolePermission 显式分配 (避免之前 thread:read 隐式放行的语义混乱)

    // Merge role-based permissions (only management type, see buildForRoles)
    const roleRules = roleIds.length
      ? (await this.buildForRoles(roleIds)).rules
      : [];
    const combinedRules = [...roleRules, ...baseRules];

    const can = (action: string, subject: string) => {
      return combinedRules.some((r) => {
        const actionMatch =
          r.action === action || r.action === 'manage' || r.action === '*';
        const subjectMatch = r.subject === subject || r.subject === '*';
        return actionMatch && subjectMatch;
      });
    };

    const cannot = (action: string, subject: string) => !can(action, subject);

    return { can, cannot, rules: combinedRules };
  }

  /**
   * @title 获取句柄
   * @description 返回 FunctionCall 描述句柄（供 function-call 框架使用）。
   * @keywords-cn 获取句柄, 功能描述
   * @keywords-en get-handle, function-description
   */
  getHandle() {
    return {
      name: 'ability_service',
      description:
        'Ability service compatible with CASL: can/cannot check by roles.',
      parameters: {},
    };
  }
}
