import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Delete,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { RoleService } from '../services/role.service';
import { CheckAbility } from '../decorators/check-ability.decorator';
import { HookLifecycle } from '@/core/hookbus/decorators/hook-lifecycle.decorator';
import type {
  CreateRoleDto,
  UpdateRoleDto,
  UpsertRolePermissionsDto,
  QueryRoleDto,
} from '../types/identity.types';

type AuthedReq = Request & { user?: { id?: string; type?: string } };

/**
 * @title Role Hook payload schema (input 形状, SSOT)
 * @keywords-cn RoleHook, payloadSchema, input
 * @keywords-en role-hook, payload-schema, input
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
  description: z.string().nullable().optional().describe('新的描述, null 表示清空'),
});

const idParamInput = z.object({
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

/**
 * @title Role 控制器
 * @description 角色与角色权限管理接口。
 * @keywords-cn 角色控制器, 权限
 * @keywords-en role-controller, permissions
 */
@Controller('identity/roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @CheckAbility('read', 'role')
  @HookLifecycle({
    hook: 'saas.app.identity.roleList',
    description:
      'RBAC 角色列表查询 :: 支持按 organizationId 过滤组织作用域, 按 q 模糊匹配 name/code; 不传过滤条件返回全部角色',
    payloadSchema: onRbacRoleListInput,
    payloadSource: 'query',
  })
  async list(@Query() query: QueryRoleDto) {
    return await this.roleService.list(query);
  }

  @Post()
  @CheckAbility('create', 'role')
  @HookLifecycle({
    hook: 'saas.app.identity.roleCreate',
    description:
      'RBAC 角色创建 :: code 必须唯一; organizationId 不传 = 系统级角色, 跨组织生效',
    payloadSchema: onRbacRoleCreateInput,
    payloadSource: 'body',
  })
  async create(@Body() dto: CreateRoleDto) {
    return await this.roleService.create(dto);
  }

  @Put(':id')
  @CheckAbility('update', 'role')
  @HookLifecycle({
    hook: 'saas.app.identity.roleUpdate',
    description: 'RBAC 角色更新 :: 仅支持改 name / description, code/organizationId 不可变',
    payloadSchema: onRbacRoleUpdateInput,
    payloadSource: 'body',
  })
  async update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    await this.roleService.update(id, dto);
    return { success: true } as const;
  }

  @Delete(':id')
  @CheckAbility('delete', 'role')
  @HookLifecycle({
    hook: 'saas.app.identity.roleDelete',
    description:
      'RBAC 角色软删除 :: 不会删除已分配的 membership, 但该角色将无法在新分配中使用',
    payloadSchema: idParamInput,
    payloadSource: 'params',
  })
  async delete(@Param('id') id: string) {
    await this.roleService.delete(id);
    return { success: true } as const;
  }

  @Get(':id/permissions')
  @CheckAbility('read', 'role_permission')
  @HookLifecycle({
    hook: 'saas.app.identity.rolePermissionList',
    description:
      'RBAC 角色权限列表查询 :: 返回该角色已分配的全部 (subject, action, permissionType) 三元组',
    payloadSchema: idParamInput,
    payloadSource: 'params',
  })
  async listPermissions(@Param('id') id: string) {
    return await this.roleService.listPermissions(id);
  }

  @Put(':id/permissions')
  @CheckAbility('update', 'role_permission')
  @HookLifecycle({
    hook: 'saas.app.identity.rolePermissionUpsert',
    description:
      'RBAC 角色权限批量替换 :: replace 语义, items 为最终全量; 受权重越权防护 (操作者在该 subject 上 maxWeight 必须 ≥ 目标节点 weight, 否则全部入参作废)',
    payloadSchema: onRbacRolePermissionUpsertInput,
    payloadSource: 'body',
  })
  async upsertPermissions(
    @Param('id') id: string,
    @Body() dto: UpsertRolePermissionsDto,
    @Req() req: AuthedReq,
  ) {
    const operatorId = req.user?.id;
    return await this.roleService.upsertPermissions(id, dto, operatorId);
  }
}
