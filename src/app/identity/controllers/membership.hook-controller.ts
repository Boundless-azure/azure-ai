import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { z } from 'zod';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import type { HookInvocationContext } from '@/core/hookbus/types/hook.types';
import { MembershipEntity } from '../entities/membership.entity';
import { RoleEntity } from '../entities/role.entity';
import { CheckAbility } from '../decorators/check-ability.decorator';

/**
 * @title Membership Hook payload schema (input 形状, SSOT)
 * @description 单对象 payload; id 场景平铺进对象 ({ id })。
 * @keywords-cn MembershipHook, payloadSchema, input, 单对象payload
 * @keywords-en membership-hook, payload-schema, input, single-object-payload
 */
const onRbacMembershipListInput = z.object({
  organizationId: z.string().optional().describe('按组织 ID 过滤'),
  principalId: z
    .string()
    .optional()
    .describe(
      '按主体 ID 过滤; 与 organizationId 同时传则取交集 (该用户在该组织的成员关系)',
    ),
  roleId: z.string().optional().describe('按角色 ID 过滤; 找出某角色所有成员'),
  active: z
    .boolean()
    .optional()
    .describe('按启用态过滤; 不传返回所有未软删 (含 active=false)'),
});

const onRbacMembershipCreateInput = z.object({
  organizationId: z.string().describe('归属组织 ID'),
  principalId: z.string().describe('成员主体 ID (任意 principalType 均可)'),
  roleId: z.string().optional().describe('优先使用 :: 直接指定角色 UUID'),
  role: z
    .string()
    .optional()
    .describe(
      '兼容旧入参 :: 角色 code (admin / guest / 自定义); 服务端按 code 反查 roleId; "owner" 自动映射为 "admin"',
    ),
});

const idField = z.object({
  id: z.string().describe('成员关系记录主键 ID (UUID)'),
});

/**
 * @title Membership Hook Controller
 * @description membership 控制器的 hook 声明层 (单对象 payload); 从 MembershipController 迁出, HTTP 与 hook 解耦。
 *   直接注入 Membership / Role 两个 repository, 完整复刻控制器业务逻辑。
 * @keywords-cn 成员Hook声明, 单对象payload
 * @keywords-en membership-hook-controller, single-object-payload
 */
@Injectable()
@HookController({ pluginName: 'identity', tags: ['identity', 'membership'] })
export class MembershipHookController {
  constructor(
    @InjectRepository(MembershipEntity)
    private readonly repo: Repository<MembershipEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
  ) {}

  /**
   * RBAC 成员关系列表查询 :: 返回带 role/roleName 的成员行。
   * @keyword-cn 成员列表, 查询
   * @keyword-en membership-list, list-memberships
   */
  @HookRoute({
    hook: 'saas.app.identity.membershipList',
    description:
      'RBAC 成员关系列表查询 :: 按 organizationId / principalId / roleId / active 过滤; 返回数据带 role (角色 code) 字段, 缺失角色映射回 "guest"',
    args: [onRbacMembershipListInput],
  })
  @CheckAbility('read', 'membership')
  async list(
    payload: z.infer<typeof onRbacMembershipListInput>,
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    const where: Record<string, unknown> = { isDelete: false };
    if (payload.organizationId) where['organizationId'] = payload.organizationId;
    if (payload.principalId) where['principalId'] = payload.principalId;
    if (payload.roleId) where['roleId'] = payload.roleId;
    if (payload.active !== undefined) {
      where['active'] = payload.active === true;
    }
    const items = await this.repo.find({ where, order: { createdAt: 'DESC' } });
    const ids = Array.from(
      new Set(
        items
          .map((m) => m.roleId)
          .filter((id): id is string => typeof id === 'string' && !!id),
      ),
    );
    const roles = ids.length
      ? await this.roleRepo.find({ where: { id: In(ids) } })
      : [];
    const codeMap = new Map<string, string>();
    const nameMap = new Map<string, string>();
    for (const r of roles) {
      codeMap.set(r.id, r.code);
      nameMap.set(r.id, r.name);
    }
    return items.map((m) => ({
      ...m,
      role: codeMap.get(m.roleId || '') || 'guest',
      roleName: m.roleId ? (nameMap.get(m.roleId) ?? null) : null,
    }));
  }

  /**
   * RBAC 成员关系创建 :: roleId / role 二选一 (roleId 优先)。
   * @keyword-cn 成员创建, 新增
   * @keyword-en membership-create, create-membership
   */
  @HookRoute({
    hook: 'saas.app.identity.membershipCreate',
    description:
      'RBAC 成员关系创建 :: roleId / role 二选一 (roleId 优先); 不会校验重复关系, 同 (org, principal) 可有多条',
    args: [onRbacMembershipCreateInput],
  })
  @CheckAbility('create', 'membership')
  async add(
    payload: z.infer<typeof onRbacMembershipCreateInput>,
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    let roleId: string | null = payload.roleId ?? null;
    if (!roleId && payload.role) {
      const code = payload.role === 'owner' ? 'admin' : payload.role;
      const role = await this.roleRepo.findOne({
        where: { code, isDelete: false },
      });
      roleId = role ? role.id : null;
    }
    const entity = this.repo.create({
      organizationId: payload.organizationId,
      principalId: payload.principalId,
      roleId,
      active: true,
      isDelete: false,
    });
    const saved = await this.repo.save(entity);
    return saved;
  }

  /**
   * RBAC 成员关系软删除。
   * @keyword-cn 成员删除, 软删
   * @keyword-en membership-delete, soft-delete
   */
  @HookRoute({
    hook: 'saas.app.identity.membershipDelete',
    description:
      'RBAC 成员关系软删除 :: isDelete=true + active=false; 用于踢出某用户或解除角色绑定',
    args: [idField],
  })
  @CheckAbility('delete', 'membership')
  async remove(
    payload: { id: string },
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    await this.repo.update(
      { id: payload.id },
      { isDelete: true, active: false },
    );
    return { success: true } as const;
  }
}
