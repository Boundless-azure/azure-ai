import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import type { HookInvocationContext } from '@/core/hookbus/types/hook.types';
import { RoleService } from '../services/role.service';
import { CheckAbility } from '../decorators/check-ability.decorator';
import type {
  CreateRoleDto,
  UpdateRoleDto,
  UpsertRolePermissionsDto,
  QueryRoleDto,
} from '../types/identity.types';

/**
 * @title Role Hook payload schema (input 形状, SSOT)
 * @description 单对象 payload; id+body 已平铺进对象 (id+body → { id, ...body })。
 * @keywords-cn RoleHook, payloadSchema, input, 单对象payload
 * @keywords-en role-hook, payload-schema, input, single-object-payload
 */
const onRbacRoleListInput = z.object({
  q: z
    .string()
    .optional()
    .describe('模糊匹配角色 name 或 code (LIKE %q%); 不传返回全量'),
  organizationId: z
    .string()
    .optional()
    .describe(
      '按组织过滤; 传 "null" 仅返回系统级角色 (organization_id IS NULL); 不传返回全部组织+系统级',
    ),
});

const onRbacRoleCountInput = z.object({
  organizationId: z
    .string()
    .optional()
    .describe('按组织 ID 过滤; 不传返回全部'),
});

const onRbacRoleCreateInput = z.object({
  name: z.string().describe('角色显示名'),
  code: z
    .string()
    .describe('角色业务编码, 唯一; 内置如 admin / guest, 自定义建议小写无空格'),
  description: z.string().nullable().optional().describe('角色用途描述, 可空'),
  organizationId: z
    .string()
    .nullable()
    .optional()
    .describe('归属组织 ID; 不传或 null 表示系统级角色'),
});

const onRbacRoleUpdateInput = z.object({
  name: z.string().optional().describe('新的角色显示名'),
  description: z
    .string()
    .nullable()
    .optional()
    .describe('新的描述, null 表示清空'),
});

const idField = z.object({
  id: z.string().describe('角色主键 ID (UUID)'),
});

const onRbacRolePermissionUpsertInput = z.object({
  items: z
    .array(
      z.object({
        subject: z
          .string()
          .describe(
            '权限主体 (CASL subject), 通常对应 RBAC 资源表名: principal / role / membership / organization / agent / knowledge / todo / file / runner 等; 应在 saas.app.identity.permissionDefinitionList(fid="null") 返回的 root nodeKey 中存在',
          ),
        action: z
          .string()
          .describe(
            '动作; 常用: read / create / update / delete / manage; 也可声明业务专用 action (如 invite / publish), 需在 permission_definitions 中定义',
          ),
        permissionType: z
          .enum(['management', 'data', 'menu'])
          .optional()
          .describe(
            '权限类型 :: management=CASL 管理权限 (默认), data=数据权限 (DataPermission applyTo 收紧 payload), menu=前端菜单权限',
          ),
      }),
    )
    .describe('整角色权限替换语义 (replace), 旧权限会被软删, 入参为最终全量'),
});

const RoleUpdateHookSchema = idField.merge(onRbacRoleUpdateInput);
const RolePermissionUpsertHookSchema = idField.merge(
  onRbacRolePermissionUpsertInput,
);

/**
 * @title Role Hook Controller
 * @description role 控制器的 hook 声明层 (单对象 payload); 从 RoleController 迁出, HTTP 与 hook 解耦。
 *   操作者 ID 从 invocationContext.principalId 解析 (权重越权防护用)。
 * @keywords-cn 角色Hook声明, 单对象payload
 * @keywords-en role-hook-controller, single-object-payload
 */
@Injectable()
@HookController({ pluginName: 'identity', tags: ['identity', 'role'] })
export class RoleHookController {
  constructor(private readonly roleService: RoleService) {}

  /**
   * 角色总数统计。
   * @keyword-cn 角色总数, 统计
   * @keyword-en role-count, count-roles
   */
  @HookRoute({
    hook: 'saas.app.identity.roleCount',
    description:
      '角色总数统计 :: 返回 { count: number }，支持按 organizationId 过滤',
    args: [onRbacRoleCountInput],
  })
  @CheckAbility('read', 'role')
  async count(
    payload: z.infer<typeof onRbacRoleCountInput>,
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    return await this.roleService.count(payload);
  }

  /**
   * RBAC 角色列表查询。
   * @keyword-cn 角色列表, 查询
   * @keyword-en role-list, list-roles
   */
  @HookRoute({
    hook: 'saas.app.identity.roleList',
    description:
      'RBAC 角色列表查询 :: 支持按 organizationId 过滤组织作用域, 按 q 模糊匹配 name/code; 不传过滤条件返回全部角色',
    args: [onRbacRoleListInput],
  })
  @CheckAbility('read', 'role')
  async list(
    payload: QueryRoleDto,
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    return await this.roleService.list(payload);
  }

  /**
   * RBAC 角色创建。
   * @keyword-cn 角色创建, 新增
   * @keyword-en role-create, create-role
   */
  @HookRoute({
    hook: 'saas.app.identity.roleCreate',
    description:
      'RBAC 角色创建 :: code 必须唯一; organizationId 不传 = 系统级角色, 跨组织生效',
    args: [onRbacRoleCreateInput],
  })
  @CheckAbility('create', 'role')
  async create(
    payload: CreateRoleDto,
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    return await this.roleService.create(payload);
  }

  /**
   * RBAC 角色更新。
   * @keyword-cn 角色更新, 改名
   * @keyword-en role-update, update-role
   */
  @HookRoute({
    hook: 'saas.app.identity.roleUpdate',
    description:
      'RBAC 角色更新 :: 仅支持改 name / description, code/organizationId 不可变',
    args: [RoleUpdateHookSchema],
  })
  @CheckAbility('update', 'role')
  async update(
    payload: z.infer<typeof RoleUpdateHookSchema>,
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    const { id, ...body } = payload;
    await this.roleService.update(id, body as UpdateRoleDto);
    return { success: true } as const;
  }

  /**
   * RBAC 角色软删除。
   * @keyword-cn 角色删除, 软删
   * @keyword-en role-delete, soft-delete
   */
  @HookRoute({
    hook: 'saas.app.identity.roleDelete',
    description:
      'RBAC 角色软删除 :: 不会删除已分配的 membership, 但该角色将无法在新分配中使用',
    args: [idField],
  })
  @CheckAbility('delete', 'role')
  async delete(
    payload: { id: string },
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    await this.roleService.delete(payload.id);
    return { success: true } as const;
  }

  /**
   * RBAC 角色权限列表查询。
   * @keyword-cn 角色权限列表, 查询
   * @keyword-en role-permission-list, list-permissions
   */
  @HookRoute({
    hook: 'saas.app.identity.rolePermissionList',
    description:
      'RBAC 角色权限列表查询 :: 返回该角色已分配的全部 (subject, action, permissionType) 三元组',
    args: [idField],
  })
  @CheckAbility('read', 'role_permission')
  async listPermissions(
    payload: { id: string },
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    return await this.roleService.listPermissions(payload.id);
  }

  /**
   * RBAC 角色权限批量替换 (replace 语义, 受权重越权防护)。
   * @keyword-cn 角色权限替换, 越权防护
   * @keyword-en role-permission-upsert, escalation-guard
   */
  @HookRoute({
    hook: 'saas.app.identity.rolePermissionUpsert',
    description:
      'RBAC 角色权限批量替换 :: replace 语义, items 为最终全量; 受权重越权防护 (操作者在该 subject 上 maxWeight 必须 ≥ 目标节点 weight, 否则全部入参作废)',
    args: [RolePermissionUpsertHookSchema],
  })
  @CheckAbility('update', 'role_permission')
  async upsertPermissions(
    payload: z.infer<typeof RolePermissionUpsertHookSchema>,
    _principal: unknown,
    context?: HookInvocationContext,
  ) {
    const { id, ...body } = payload;
    const operatorId = context?.principalId;
    return await this.roleService.upsertPermissions(
      id,
      body as UpsertRolePermissionsDto,
      operatorId,
    );
  }
}
