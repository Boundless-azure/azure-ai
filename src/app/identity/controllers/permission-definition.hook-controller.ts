import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import type { HookInvocationContext } from '@/core/hookbus/types/hook.types';
import { PermissionDefinitionService } from '../services/permission-definition.service';
import { CheckAbility } from '../decorators/check-ability.decorator';
import { PermissionDefinitionType } from '../enums/permission.enums';
import type {
  CreatePermissionDefinitionDto,
  UpdatePermissionDefinitionDto,
  QueryPermissionDefinitionDto,
} from '../types/identity.types';

/**
 * @title PermissionDefinition Hook payload schema (input 形状, SSOT)
 * @description 单对象 payload; id+body 已平铺进对象 (id+body → { id, ...body })。
 * @keywords-cn PermissionDefinitionHook, payloadSchema, input, 单对象payload
 * @keywords-en permission-definition-hook, payload-schema, input, single-object-payload
 */
const permissionTypeSchema = z
  .enum([
    PermissionDefinitionType.Management,
    PermissionDefinitionType.Data,
    PermissionDefinitionType.Menu,
  ])
  .describe(
    '权限类型 :: management=CASL 管理权限, data=数据权限 (DataPermission applyTo 收紧 payload), menu=前端菜单权限',
  );

const permissionExtraDataSchema = z
  .object({
    weight: z
      .number()
      .int()
      .optional()
      .describe('节点权重, 越权防护用 :: 数值越大权限越高, root 默认 0'),
    description: z.string().optional().describe('用于前端展示的额外说明'),
    order: z.number().int().optional().describe('UI 排序'),
  })
  .catchall(z.unknown())
  .describe(
    '节点扩展元数据, 已知字段如 weight/description/order, 也可放任意自定义键',
  );

const onRbacPermissionDefinitionListInput = z.object({
  permissionType: permissionTypeSchema.optional().describe('按权限类型过滤'),
  nodeKey: z
    .string()
    .optional()
    .describe('精确匹配 node_key (subject 名或 action 名)'),
  fid: z
    .string()
    .nullable()
    .optional()
    .describe(
      '父节点 ID 过滤 :: 传 "null" 仅返回 root 节点 (各 subject 根); 传具体 id 返回该 subject 下子节点; 不传返回全量',
    ),
});

const onRbacPermissionDefinitionCreateInput = z.object({
  fid: z
    .string()
    .nullable()
    .optional()
    .describe('父节点 ID; null 表示 root (subject 根节点)'),
  nodeKey: z
    .string()
    .describe(
      '节点键 :: root 节点存 subject 名 (如 "principal"), 子节点存 action 名 (如 "read")',
    ),
  extraData: permissionExtraDataSchema.nullable().optional(),
  description: z.string().optional().describe('节点用途描述'),
  permissionType: permissionTypeSchema.optional(),
});

const onRbacPermissionDefinitionUpdateInput = z.object({
  fid: z.string().nullable().optional().describe('改父节点指向 (谨慎使用)'),
  nodeKey: z
    .string()
    .optional()
    .describe('改节点键 (谨慎, 会影响 RolePermission 引用)'),
  extraData: permissionExtraDataSchema.nullable().optional(),
  description: z.string().optional(),
  permissionType: permissionTypeSchema.optional(),
});

const idField = z.object({
  id: z.string().describe('权限定义节点主键 ID (UUID)'),
});

const PermissionDefinitionUpdateHookSchema = idField.merge(
  onRbacPermissionDefinitionUpdateInput,
);

/**
 * @title PermissionDefinition Hook Controller
 * @description permission-definition 控制器的 hook 声明层 (单对象 payload); 从 PermissionDefinitionController 迁出, HTTP 与 hook 解耦。
 * @keywords-cn 权限定义Hook声明, 单对象payload
 * @keywords-en permission-definition-hook-controller, single-object-payload
 */
@Injectable()
@HookController({
  pluginName: 'identity',
  tags: ['identity', 'permission-definition'],
})
export class PermissionDefinitionHookController {
  constructor(private readonly service: PermissionDefinitionService) {}

  /**
   * RBAC 权限定义列表查询。
   * @keyword-cn 权限定义列表, 查询
   * @keyword-en permission-definition-list, list-definitions
   */
  @HookRoute({
    hook: 'saas.app.identity.permissionDefinitionList',
    description:
      'RBAC 权限定义列表查询 :: 支持按 permissionType / nodeKey / fid 过滤; 推荐先 fid="null" 拿全部 subject root, 再用 fid=<rootId> 取该 subject 的可用 action',
    args: [onRbacPermissionDefinitionListInput],
  })
  @CheckAbility('read', 'permission_definition')
  async list(
    payload: QueryPermissionDefinitionDto,
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    return await this.service.list(payload);
  }

  /**
   * RBAC 权限定义创建。
   * @keyword-cn 权限定义创建, 新增
   * @keyword-en permission-definition-create, create-definition
   */
  @HookRoute({
    hook: 'saas.app.identity.permissionDefinitionCreate',
    description:
      'RBAC 权限定义创建 :: data 类型节点通常由 @DataPermissionNode 装饰器在启动期自动同步, 手动创建主要用于 management/menu 节点扩展',
    args: [onRbacPermissionDefinitionCreateInput],
  })
  @CheckAbility('create', 'permission_definition')
  async create(
    payload: CreatePermissionDefinitionDto,
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    return await this.service.create(payload);
  }

  /**
   * RBAC 权限定义更新。
   * @keyword-cn 权限定义更新, 改节点
   * @keyword-en permission-definition-update, update-definition
   */
  @HookRoute({
    hook: 'saas.app.identity.permissionDefinitionUpdate',
    description:
      'RBAC 权限定义更新 :: weight 不在此修改 (装饰器是 SSOT); 谨慎改 nodeKey/fid, 已分配的 RolePermission 引用通过名称, 改名会失配',
    args: [PermissionDefinitionUpdateHookSchema],
  })
  @CheckAbility('update', 'permission_definition')
  async update(
    payload: z.infer<typeof PermissionDefinitionUpdateHookSchema>,
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    const { id, ...body } = payload;
    await this.service.update(id, body as UpdatePermissionDefinitionDto);
    return { success: true } as const;
  }

  /**
   * RBAC 权限定义级联软删除。
   * @keyword-cn 权限定义删除, 级联软删
   * @keyword-en permission-definition-delete, cascade-soft-delete
   */
  @HookRoute({
    hook: 'saas.app.identity.permissionDefinitionDelete',
    description:
      'RBAC 权限定义级联软删除 :: 同时软删该节点全部子孙节点; 已分配的 RolePermission 不会自动清理, 删 root 后该 subject 的权限分配将无法通过越权防护',
    args: [idField],
  })
  @CheckAbility('delete', 'permission_definition')
  async remove(
    payload: { id: string },
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    await this.service.remove(payload.id);
    return { success: true } as const;
  }
}
