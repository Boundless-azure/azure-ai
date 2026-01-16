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
  async list(@Query() query: QueryOrganizationDto) {
    return await this.orgService.list(query);
  }

  @Post()
  @CheckAbility('create', 'organization')
  async create(@Body() dto: CreateOrganizationDto) {
    return await this.orgService.create(dto);
  }

  @Put(':id')
  @CheckAbility('update', 'organization')
  async update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    await this.orgService.update(id, dto);
    return { success: true } as const;
  }

  @Delete(':id')
  @CheckAbility('delete', 'organization')
  async delete(@Param('id') id: string) {
    await this.orgService.delete(id);
    return { success: true } as const;
  }
}
