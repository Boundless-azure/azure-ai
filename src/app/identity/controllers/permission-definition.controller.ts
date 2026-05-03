import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { PermissionDefinitionService } from '../services/permission-definition.service';
import { CheckAbility } from '../decorators/check-ability.decorator';
import { HookLifecycle } from '@/core/hookbus/decorators/hook-lifecycle.decorator';
import { PermissionDefinitionType } from '../enums/permission.enums';
import type {
  CreatePermissionDefinitionDto,
  UpdatePermissionDefinitionDto,
  QueryPermissionDefinitionDto,
} from '../types/identity.types';

/**
 * @title PermissionDefinition Hook payload schema (input 形状, SSOT)
 * @keywords-cn PermissionDefinitionHook, payloadSchema, input
 * @keywords-en permission-definition-hook, payload-schema, input
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

/** 权限定义元数据扩展字段 :: 自由 JSON 但常见字段已知, 显式列出便于 LLM 理解 */
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
  .describe('节点扩展元数据, 已知字段如 weight/description/order, 也可放任意自定义键');

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
    .describe('节点键 :: root 节点存 subject 名 (如 "principal"), 子节点存 action 名 (如 "read")'),
  extraData: permissionExtraDataSchema.nullable().optional(),
  description: z.string().optional().describe('节点用途描述'),
  permissionType: permissionTypeSchema.optional(),
});

const onRbacPermissionDefinitionUpdateInput = z.object({
  fid: z.string().nullable().optional().describe('改父节点指向 (谨慎使用)'),
  nodeKey: z.string().optional().describe('改节点键 (谨慎, 会影响 RolePermission 引用)'),
  extraData: permissionExtraDataSchema.nullable().optional(),
  description: z.string().optional(),
  permissionType: permissionTypeSchema.optional(),
});

const idParamInput = z.object({
  id: z.string().describe('权限定义节点主键 ID (UUID)'),
});

/**
 * @title PermissionDefinition 控制器
 * @description 权限定义的查询与维护接口。
 * @keywords-cn 权限定义控制器, 权限枚举
 * @keywords-en permission-definition-controller, permissions-enum
 */
@Controller('identity/permissions/definitions')
export class PermissionDefinitionController {
  constructor(private readonly service: PermissionDefinitionService) {}

  @Get()
  @CheckAbility('read', 'permission_definition')
  @HookLifecycle({
    hook: 'saas.app.identity.permissionDefinitionList',
    description:
      'RBAC 权限定义列表查询 :: 支持按 permissionType / nodeKey / fid 过滤; 推荐先 fid="null" 拿全部 subject root, 再用 fid=<rootId> 取该 subject 的可用 action',
    payloadSchema: onRbacPermissionDefinitionListInput,
    payloadSource: 'query',
  })
  async list(@Query() query: QueryPermissionDefinitionDto) {
    return await this.service.list(query);
  }

  @Post()
  @CheckAbility('create', 'permission_definition')
  @HookLifecycle({
    hook: 'saas.app.identity.permissionDefinitionCreate',
    description:
      'RBAC 权限定义创建 :: data 类型节点通常由 @DataPermissionNode 装饰器在启动期自动同步, 手动创建主要用于 management/menu 节点扩展',
    payloadSchema: onRbacPermissionDefinitionCreateInput,
    payloadSource: 'body',
  })
  async create(@Body() dto: CreatePermissionDefinitionDto) {
    return await this.service.create(dto);
  }

  @Put(':id')
  @CheckAbility('update', 'permission_definition')
  @HookLifecycle({
    hook: 'saas.app.identity.permissionDefinitionUpdate',
    description:
      'RBAC 权限定义更新 :: weight 不在此修改 (装饰器是 SSOT); 谨慎改 nodeKey/fid, 已分配的 RolePermission 引用通过名称, 改名会失配',
    payloadSchema: onRbacPermissionDefinitionUpdateInput,
    payloadSource: 'body',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionDefinitionDto,
  ) {
    await this.service.update(id, dto);
    return { success: true } as const;
  }

  @Delete(':id')
  @CheckAbility('delete', 'permission_definition')
  @HookLifecycle({
    hook: 'saas.app.identity.permissionDefinitionDelete',
    description:
      'RBAC 权限定义级联软删除 :: 同时软删该节点全部子孙节点; 已分配的 RolePermission 不会自动清理, 删 root 后该 subject 的权限分配将无法通过越权防护',
    payloadSchema: idParamInput,
    payloadSource: 'params',
  })
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { success: true } as const;
  }
}
