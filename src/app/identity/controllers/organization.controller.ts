import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Delete,
  Query,
} from '@nestjs/common';
import { OrganizationService } from '../services/organization.service';
import { CheckAbility } from '../decorators/check-ability.decorator';
import { HookLifecycle } from '@/core/hookbus/decorators/hook-lifecycle.decorator';
import type {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  QueryOrganizationDto,
} from '../types/identity.types';

/**
 * @title Organization 控制器
 * @description 组织/租户的增删改查接口。
 * @keywords-cn 组织控制器, 租户
 * @keywords-en organization-controller, tenant
 */
@Controller('identity/organizations')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Get()
  @CheckAbility('read', 'organization')
  @HookLifecycle({
    hook: 'onRbacOrganizationList',
    description: 'RBAC组织列表查询',
  })
  async list(@Query() query: QueryOrganizationDto) {
    return await this.orgService.list(query);
  }

  @Post()
  @CheckAbility('create', 'organization')
  @HookLifecycle({
    hook: 'onRbacOrganizationCreate',
    description: 'RBAC组织创建',
  })
  async create(@Body() dto: CreateOrganizationDto) {
    return await this.orgService.create(dto);
  }

  @Put(':id')
  @CheckAbility('update', 'organization')
  @HookLifecycle({
    hook: 'onRbacOrganizationUpdate',
    description: 'RBAC组织更新',
  })
  async update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    await this.orgService.update(id, dto);
    return { success: true } as const;
  }

  @Delete(':id')
  @CheckAbility('delete', 'organization')
  @HookLifecycle({
    hook: 'onRbacOrganizationDelete',
    description: 'RBAC组织删除',
  })
  async delete(@Param('id') id: string) {
    await this.orgService.delete(id);
    return { success: true } as const;
  }
}
