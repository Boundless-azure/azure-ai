import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Delete,
} from '@nestjs/common';
import { RoleService } from '../services/role.service';
import { CheckAbility } from '../decorators/check-ability.decorator';
import { HookLifecycle } from '@/core/hookbus/decorators/hook-lifecycle.decorator';
import type {
  CreateRoleDto,
  UpdateRoleDto,
  UpsertRolePermissionsDto,
} from '../types/identity.types';

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
    hook: 'onRbacRoleList',
    description: 'RBAC角色列表查询',
  })
  async list() {
    return await this.roleService.list();
  }

  @Post()
  @CheckAbility('create', 'role')
  @HookLifecycle({
    hook: 'onRbacRoleCreate',
    description: 'RBAC角色创建',
  })
  async create(@Body() dto: CreateRoleDto) {
    return await this.roleService.create(dto);
  }

  @Put(':id')
  @CheckAbility('update', 'role')
  @HookLifecycle({
    hook: 'onRbacRoleUpdate',
    description: 'RBAC角色更新',
  })
  async update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    await this.roleService.update(id, dto);
    return { success: true } as const;
  }

  @Delete(':id')
  @CheckAbility('delete', 'role')
  @HookLifecycle({
    hook: 'onRbacRoleDelete',
    description: 'RBAC角色删除',
  })
  async delete(@Param('id') id: string) {
    await this.roleService.delete(id);
    return { success: true } as const;
  }

  @Get(':id/permissions')
  @CheckAbility('read', 'role_permission')
  @HookLifecycle({
    hook: 'onRbacRolePermissionList',
    description: 'RBAC角色权限列表查询',
  })
  async listPermissions(@Param('id') id: string) {
    return await this.roleService.listPermissions(id);
  }

  @Put(':id/permissions')
  @CheckAbility('update', 'role_permission')
  @HookLifecycle({
    hook: 'onRbacRolePermissionUpsert',
    description: 'RBAC角色权限更新',
  })
  async upsertPermissions(
    @Param('id') id: string,
    @Body() dto: UpsertRolePermissionsDto,
  ) {
    return await this.roleService.upsertPermissions(id, dto);
  }
}
