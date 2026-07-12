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
import { RoleService } from '../services/role.service';
import { CheckAbility } from '../decorators/check-ability.decorator';
import type {
  CreateRoleDto,
  UpdateRoleDto,
  UpsertRolePermissionsDto,
  QueryRoleDto,
} from '../types/identity.types';

type AuthedReq = Request & { user?: { id?: string; type?: string } };

/**
 * @title Role 控制器
 * @description 角色与角色权限管理接口。
 * @keywords-cn 角色控制器, 权限
 * @keywords-en role-controller, permissions
 */
@Controller('identity/roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get('count')
  @CheckAbility('read', 'role')
  async count(@Query() query: { organizationId?: string }) {
    return await this.roleService.count(query);
  }

  @Get()
  @CheckAbility('read', 'role')
  async list(@Query() query: QueryRoleDto) {
    return await this.roleService.list(query);
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
    @Req() req: AuthedReq,
  ) {
    const operatorId = req.user?.id;
    return await this.roleService.upsertPermissions(id, dto, operatorId);
  }
}
