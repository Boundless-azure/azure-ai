import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Delete,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { z } from 'zod';
import { MembershipEntity } from '../entities/membership.entity';
import { RoleEntity } from '../entities/role.entity';
import { CheckAbility } from '../decorators/check-ability.decorator';
import { HookLifecycle } from '@/core/hookbus/decorators/hook-lifecycle.decorator';

/**
 * @title Membership Hook payload schema (input 形状, SSOT)
 * @keywords-cn MembershipHook, payloadSchema, input
 * @keywords-en membership-hook, payload-schema, input
 */
const onRbacMembershipListInput = z.object({
  organizationId: z
    .string()
    .optional()
    .describe('按组织 ID 过滤'),
  principalId: z
    .string()
    .optional()
    .describe('按主体 ID 过滤; 与 organizationId 同时传则取交集 (该用户在该组织的成员关系)'),
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

const idParamInput = z.object({
  id: z.string().describe('成员关系记录主键 ID (UUID)'),
});

/**
 * @title Membership 控制器
 * @description 组织成员关系管理接口。
 * @keywords-cn 成员控制器, 组织成员
 * @keywords-en membership-controller, organization-members
 */
@Controller('identity/memberships')
export class MembershipController {
  constructor(
    @InjectRepository(MembershipEntity)
    private readonly repo: Repository<MembershipEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
  ) {}

  @Get()
  @CheckAbility('read', 'membership')
  @HookLifecycle({
    hook: 'saas.app.identity.membershipList',
    description:
      'RBAC 成员关系列表查询 :: 按 organizationId / principalId / roleId / active 过滤; 返回数据带 role (角色 code) 字段, 缺失角色映射回 "guest"',
    payloadSchema: onRbacMembershipListInput,
    payloadSource: 'query',
  })
  async list(
    @Query()
    query: {
      organizationId?: string;
      principalId?: string;
      roleId?: string;
      active?: string | boolean;
    },
  ) {
    const where: Record<string, unknown> = { isDelete: false };
    if (query.organizationId) where['organizationId'] = query.organizationId;
    if (query.principalId) where['principalId'] = query.principalId;
    if (query.roleId) where['roleId'] = query.roleId;
    if (query.active !== undefined) {
      where['active'] =
        query.active === true ||
        query.active === 'true' ||
        query.active === '1';
    }
    const items = await this.repo.find({ where, order: { createdAt: 'DESC' } });
    const ids = Array.from(
      new Set(
        items
          .map((m) => m.roleId)
          .filter((id): id is string => typeof id === 'string' && !!id),
      ),
    );
    // 修复 :: 必须用 In(ids), 直接 { id: ids } TypeORM 不会自动转 IN, 会查不到任何 role,
    // 导致前端把所有真实 roleId 误判为 "未关联角色 (历史数据)".
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
      // role :: 角色 code (业务标识, 仍保留 fallback "guest" 兼容已有调用方)
      role: codeMap.get(m.roleId || '') || 'guest',
      // roleName :: 角色显示名 (RoleEntity.name); 真没匹配上时回 null, 前端据此走 fallback 提示
      roleName: m.roleId ? (nameMap.get(m.roleId) ?? null) : null,
    }));
  }

  @Post()
  @CheckAbility('create', 'membership')
  @HookLifecycle({
    hook: 'saas.app.identity.membershipCreate',
    description:
      'RBAC 成员关系创建 :: roleId / role 二选一 (roleId 优先); 不会校验重复关系, 同 (org, principal) 可有多条',
    payloadSchema: onRbacMembershipCreateInput,
    payloadSource: 'body',
  })
  async add(
    @Body()
    dto: {
      organizationId: string;
      principalId: string;
      roleId?: string;
      role?: string;
    },
  ) {
    let roleId: string | null = dto.roleId ?? null;
    if (!roleId && dto.role) {
      const code = dto.role === 'owner' ? 'admin' : dto.role;
      const role = await this.roleRepo.findOne({
        where: { code, isDelete: false },
      });
      roleId = role ? role.id : null;
    }
    const entity = this.repo.create({
      organizationId: dto.organizationId,
      principalId: dto.principalId,
      roleId,
      active: true,
      isDelete: false,
    });
    const saved = await this.repo.save(entity);
    return saved;
  }

  @Delete(':id')
  @CheckAbility('delete', 'membership')
  @HookLifecycle({
    hook: 'saas.app.identity.membershipDelete',
    description:
      'RBAC 成员关系软删除 :: isDelete=true + active=false; 用于踢出某用户或解除角色绑定',
    payloadSchema: idParamInput,
    payloadSource: 'params',
  })
  async remove(@Param('id') id: string) {
    await this.repo.update({ id }, { isDelete: true, active: false });
    return { success: true } as const;
  }
}
