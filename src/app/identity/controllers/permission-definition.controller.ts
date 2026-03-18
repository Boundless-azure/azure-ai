import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
} from '@nestjs/common';
import { PermissionDefinitionService } from '../services/permission-definition.service';
import { CheckAbility } from '../decorators/check-ability.decorator';
import { HookLifecycle } from '@/core/hookbus/decorators/hook-lifecycle.decorator';
import type {
  CreatePermissionDefinitionDto,
  UpdatePermissionDefinitionDto,
} from '../types/identity.types';

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
    hook: 'onRbacPermissionDefinitionList',
    description: 'RBAC权限定义列表查询',
  })
  async list() {
    return await this.service.list();
  }

  @Post()
  @CheckAbility('create', 'permission_definition')
  @HookLifecycle({
    hook: 'onRbacPermissionDefinitionCreate',
    description: 'RBAC权限定义创建',
  })
  async create(@Body() dto: CreatePermissionDefinitionDto) {
    return await this.service.create(dto);
  }

  @Put(':id')
  @CheckAbility('update', 'permission_definition')
  @HookLifecycle({
    hook: 'onRbacPermissionDefinitionUpdate',
    description: 'RBAC权限定义更新',
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
    hook: 'onRbacPermissionDefinitionDelete',
    description: 'RBAC权限定义删除',
  })
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { success: true } as const;
  }
}
