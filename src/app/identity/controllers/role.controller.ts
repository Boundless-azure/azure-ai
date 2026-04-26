import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Delete,
} from '@nestjs/common';
import { z } from 'zod';
import { RoleService } from '../services/role.service';
import { CheckAbility } from '../decorators/check-ability.decorator';
import { HookLifecycle } from '@/core/hookbus/decorators/hook-lifecycle.decorator';
import type {
  CreateRoleDto,
  UpdateRoleDto,
  UpsertRolePermissionsDto,
} from '../types/identity.types';

/**
 * @title Role Hook payload schema (input 形状, SSOT)
 * @keywords-cn RoleHook, payloadSchema, input
 * @keywords-en role-hook, payload-schema, input
 */
const onRbacRoleListInput = z.object({});

const onRbacRoleCreateInput = z.object({
  name: z.string(),
  code: z.string(),
  description: z.string().nullable().optional(),
  organizationId: z.string().nullable().optional(),
});

const onRbacRoleUpdateInput = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
});

const idParamInput = z.object({ id: z.string() });

const onRbacRolePermissionUpsertInput = z.object({
  items: z.array(
    z.object({
      subject: z.string(),
      action: z.string(),
      conditions: z.record(z.string(), z.unknown()).nullable().optional(),
    }),
  ),
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
    description: 'RBAC角色列表查询',
    payloadSchema: onRbacRoleListInput,
    payloadSource: 'query',
  })
  async list() {
    return await this.roleService.list();
  }

  @Post()
  @CheckAbility('create', 'role')
  @HookLifecycle({
    hook: 'saas.app.identity.roleCreate',
    description: 'RBAC角色创建',
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
    description: 'RBAC角色更新',
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
    description: 'RBAC角色删除',
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
    description: 'RBAC角色权限列表查询',
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
    description: 'RBAC角色权限更新',
    payloadSchema: onRbacRolePermissionUpsertInput,
    payloadSource: 'body',
  })
  async upsertPermissions(
    @Param('id') id: string,
    @Body() dto: UpsertRolePermissionsDto,
  ) {
    return await this.roleService.upsertPermissions(id, dto);
  }
}
