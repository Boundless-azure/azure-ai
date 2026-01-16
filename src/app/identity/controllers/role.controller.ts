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
  async list() {
    return await this.roleService.list();
  }

  @Post()
  @CheckAbility('create', 'role')
  async create(@Body() dto: CreateRoleDto) {
    return await this.roleService.create(dto);
  }

  @Put(':id')
  @CheckAbility('update', 'role')
  async update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    await this.roleService.update(id, dto);
    return { success: true } as const;
  }

  @Delete(':id')
  @CheckAbility('delete', 'role')
  async delete(@Param('id') id: string) {
    await this.roleService.delete(id);
    return { success: true } as const;
  }

  @Get(':id/permissions')
  @CheckAbility('read', 'role_permission')
  async listPermissions(@Param('id') id: string) {
    return await this.roleService.listPermissions(id);
  }

  @Put(':id/permissions')
  @CheckAbility('update', 'role_permission')
  async upsertPermissions(
    @Param('id') id: string,
    @Body() dto: UpsertRolePermissionsDto,
  ) {
    return await this.roleService.upsertPermissions(id, dto);
  }
}
