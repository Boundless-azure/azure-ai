import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { RolePermissionEntity } from '../entities/role-permission.entity';
import { MembershipEntity } from '../entities/membership.entity';
import { MembershipRole } from '../enums/principal.enums';

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
  ) {}

  /**
   * @title 计算能力
   * @description 根据角色ID列表合并权限，返回 can/cannot 接口。
   */
  async buildForRoles(roleIds: string[]): Promise<{
    can: (
      action: string,
      subject: string,
      ctx?: Record<string, unknown>,
    ) => boolean;
    cannot: (
      action: string,
      subject: string,
      ctx?: Record<string, unknown>,
    ) => boolean;
    rules: Array<{
      subject: string;
      action: string;
      conditions?: Record<string, unknown>;
    }>;
  }> {
    const items = await this.permRepo.find({
      where: roleIds.length ? { roleId: In(roleIds) } : { isDelete: false },
    });
    const rules = items.map((r) => ({
      subject: r.subject,
      action: r.action,
      conditions: r.conditions ?? undefined,
    }));

    const can = (
      action: string,
      subject: string,
      ctx?: Record<string, unknown>,
    ) => {
      return rules.some((r) => {
        // 支持 manage/* 通配：manage 或 * 表示任意动作；subject 为 * 表示任意资源
        const actionMatch =
          r.action === action || r.action === 'manage' || r.action === '*';
        const subjectMatch = r.subject === subject || r.subject === '*';
        if (!actionMatch || !subjectMatch) return false;
        if (!r.conditions) return true;
        try {
          const keys = Object.keys(r.conditions);
          return keys.every((k) => {
            const expected = (r.conditions as Record<string, unknown>)[k];
            const actual = ctx ? ctx[k] : undefined;
            return expected === actual;
          });
        } catch {
          return false;
        }
      });
    };

    const cannot = (
      action: string,
      subject: string,
      ctx?: Record<string, unknown>,
    ) => !can(action, subject, ctx);

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
      ctx?: Record<string, unknown>,
    ) => boolean;
    cannot: (
      action: string,
      subject: string,
      ctx?: Record<string, unknown>,
    ) => boolean;
    rules: Array<{
      subject: string;
      action: string;
      conditions?: Record<string, unknown>;
    }>;
  }> {
    const memberships = await this.membershipRepo.find({
      where: { principalId, isDelete: false },
    });
    const isAdminLike = memberships.some(
      (m) => m.role === MembershipRole.Owner || m.role === MembershipRole.Admin,
    );

    const baseRules: Array<{
      subject: string;
      action: string;
      conditions?: Record<string, unknown>;
    }> = [];

    if (isAdminLike) {
      baseRules.push({ subject: 'thread', action: 'read' });
      baseRules.push({ subject: 'thread', action: 'manage' });
    } else {
      baseRules.push({
        subject: 'thread',
        action: 'read',
        conditions: { principalId },
      });
    }

    const can = (
      action: string,
      subject: string,
      ctx?: Record<string, unknown>,
    ) => {
      return baseRules.some((r) => {
        const actionMatch =
          r.action === action || r.action === 'manage' || r.action === '*';
        const subjectMatch = r.subject === subject || r.subject === '*';
        if (!actionMatch || !subjectMatch) return false;
        if (!r.conditions) return true;
        try {
          const keys = Object.keys(r.conditions);
          return keys.every((k) => {
            const expected = (r.conditions as Record<string, unknown>)[k];
            const actual = ctx ? ctx[k] : undefined;
            return expected === actual;
          });
        } catch {
          return false;
        }
      });
    };

    const cannot = (
      action: string,
      subject: string,
      ctx?: Record<string, unknown>,
    ) => !can(action, subject, ctx);

    return { can, cannot, rules: baseRules };
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
