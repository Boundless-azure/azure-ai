import { Body, Controller, Get, Post, Delete, Param } from '@nestjs/common';
import { PermissionDefinitionService } from '../services/permission-definition.service';
import { CheckAbility } from '../decorators/check-ability.decorator';

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
  async list() {
    return await this.service.list();
  }

  @Post()
  @CheckAbility('create', 'permission_definition')
  async create(
    @Body() dto: { subject: string; action: string; description?: string },
  ) {
    return await this.service.create(dto);
  }

  @Delete(':id')
  @CheckAbility('delete', 'permission_definition')
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { success: true } as const;
  }
}
