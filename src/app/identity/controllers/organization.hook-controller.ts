import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import type { HookInvocationContext } from '@/core/hookbus/types/hook.types';
import { OrganizationService } from '../services/organization.service';
import { CheckAbility } from '../decorators/check-ability.decorator';
import type {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  QueryOrganizationDto,
} from '../types/identity.types';

/**
 * @title Organization Hook payload schema (input 形状, SSOT)
 * @description 单对象 payload; id+body 已平铺进对象 (id+body → { id, ...body })。
 * @keywords-cn OrganizationHook, payloadSchema, input, 单对象payload
 * @keywords-en organization-hook, payload-schema, input, single-object-payload
 */
const onRbacOrganizationListInput = z.object({
  q: z.string().optional().describe('模糊匹配 name / code (LIKE %q%)'),
});

const onRbacOrganizationCreateInput = z.object({
  name: z.string().describe('组织/租户显示名'),
  code: z
    .string()
    .nullable()
    .optional()
    .describe('唯一短码; 用于业务关联引用, 建议小写无空格'),
});

const onRbacOrganizationUpdateInput = z.object({
  name: z.string().optional(),
  code: z.string().nullable().optional(),
  active: z.boolean().optional().describe('启停; false 时旗下成员仍存在'),
});

const idField = z.object({
  id: z.string().describe('组织主键 ID (UUID)'),
});

const OrganizationUpdateHookSchema = idField.merge(
  onRbacOrganizationUpdateInput,
);

/**
 * @title Organization Hook Controller
 * @description organization 控制器的 hook 声明层 (单对象 payload); 从 OrganizationController 迁出, HTTP 与 hook 解耦。
 * @keywords-cn 组织Hook声明, 单对象payload
 * @keywords-en organization-hook-controller, single-object-payload
 */
@Injectable()
@HookController({ pluginName: 'identity', tags: ['identity', 'organization'] })
export class OrganizationHookController {
  constructor(private readonly orgService: OrganizationService) {}

  /**
   * RBAC 组织/租户列表查询。
   * @keyword-cn 组织列表, 查询
   * @keyword-en organization-list, list-organizations
   */
  @HookRoute({
    hook: 'saas.app.identity.organizationList',
    description:
      'RBAC 组织/租户列表查询 :: 仅按 q 模糊匹配 name/code; 默认按 createdAt 倒序返回未软删组织',
    args: [onRbacOrganizationListInput],
  })
  @CheckAbility('read', 'organization')
  async list(
    payload: QueryOrganizationDto,
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    return await this.orgService.list(payload);
  }

  /**
   * RBAC 组织创建。
   * @keyword-cn 组织创建, 新增
   * @keyword-en organization-create, create-organization
   */
  @HookRoute({
    hook: 'saas.app.identity.organizationCreate',
    description: 'RBAC 组织创建 :: code 不强制唯一 (业务自管), 创建即激活',
    args: [onRbacOrganizationCreateInput],
  })
  @CheckAbility('create', 'organization')
  async create(
    payload: CreateOrganizationDto,
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    return await this.orgService.create(payload);
  }

  /**
   * RBAC 组织更新。
   * @keyword-cn 组织更新, 改资料
   * @keyword-en organization-update, update-organization
   */
  @HookRoute({
    hook: 'saas.app.identity.organizationUpdate',
    description: 'RBAC 组织更新',
    args: [OrganizationUpdateHookSchema],
  })
  @CheckAbility('update', 'organization')
  async update(
    payload: z.infer<typeof OrganizationUpdateHookSchema>,
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    const { id, ...body } = payload;
    await this.orgService.update(id, body as UpdateOrganizationDto);
    return { success: true } as const;
  }

  /**
   * RBAC 组织软删除。
   * @keyword-cn 组织删除, 软删
   * @keyword-en organization-delete, soft-delete
   */
  @HookRoute({
    hook: 'saas.app.identity.organizationDelete',
    description:
      'RBAC 组织软删除 :: 同时置 active=false; 旗下成员/角色不会级联清理, 业务层需自行处理',
    args: [idField],
  })
  @CheckAbility('delete', 'organization')
  async delete(
    payload: { id: string },
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    await this.orgService.delete(payload.id);
    return { success: true } as const;
  }
}
