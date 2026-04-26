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
import { z } from 'zod';
import { OrganizationService } from '../services/organization.service';
import { CheckAbility } from '../decorators/check-ability.decorator';
import { HookLifecycle } from '@/core/hookbus/decorators/hook-lifecycle.decorator';
import type {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  QueryOrganizationDto,
} from '../types/identity.types';

/**
 * @title Organization Hook payload schema (input 形状, SSOT)
 * @keywords-cn OrganizationHook, payloadSchema, input
 * @keywords-en organization-hook, payload-schema, input
 */
const onRbacOrganizationListInput = z.object({
  q: z.string().optional(),
});

const onRbacOrganizationCreateInput = z.object({
  name: z.string(),
  code: z.string().nullable().optional(),
});

const onRbacOrganizationUpdateInput = z.object({
  name: z.string().optional(),
  code: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

const idParamInput = z.object({ id: z.string() });

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
    hook: 'saas.app.identity.organizationList',
    description: 'RBAC组织列表查询',
    payloadSchema: onRbacOrganizationListInput,
    payloadSource: 'query',
  })
  async list(@Query() query: QueryOrganizationDto) {
    return await this.orgService.list(query);
  }

  @Post()
  @CheckAbility('create', 'organization')
  @HookLifecycle({
    hook: 'saas.app.identity.organizationCreate',
    description: 'RBAC组织创建',
    payloadSchema: onRbacOrganizationCreateInput,
    payloadSource: 'body',
  })
  async create(@Body() dto: CreateOrganizationDto) {
    return await this.orgService.create(dto);
  }

  @Put(':id')
  @CheckAbility('update', 'organization')
  @HookLifecycle({
    hook: 'saas.app.identity.organizationUpdate',
    description: 'RBAC组织更新',
    payloadSchema: onRbacOrganizationUpdateInput,
    payloadSource: 'body',
  })
  async update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    await this.orgService.update(id, dto);
    return { success: true } as const;
  }

  @Delete(':id')
  @CheckAbility('delete', 'organization')
  @HookLifecycle({
    hook: 'saas.app.identity.organizationDelete',
    description: 'RBAC组织删除',
    payloadSchema: idParamInput,
    payloadSource: 'params',
  })
  async delete(@Param('id') id: string) {
    await this.orgService.delete(id);
    return { success: true } as const;
  }
}
