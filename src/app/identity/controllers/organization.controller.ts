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
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
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
  q: z.string().optional().describe('模糊匹配 name / code (LIKE %q%)'),
});

const onRbacOrganizationCreateInput = z.object({
  name: z.string().describe('组织/租户显示名'),
  code: z
    .string()
    .nullable()
    .optional()
    .describe('唯一短码; 用于业务关联引用, 建议小写无空格'),
});

const onRbacOrganizationUpdateInput = z.object({
  name: z.string().optional(),
  code: z.string().nullable().optional(),
  active: z.boolean().optional().describe('启停; false 时旗下成员仍存在'),
});

const idParamInput = z.object({
  id: z.string().describe('组织主键 ID (UUID)'),
});

/**
 * @title Organization 控制器
 * @description 组织/租户的增删改查接口。
 * @keywords-cn 组织控制器, 租户
 * @keywords-en organization-controller, tenant
 */
@HookController({ pluginName: 'identity', tags: ['identity', 'organization'] })
@Controller('identity/organizations')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Get()
  @CheckAbility('read', 'organization')
  @HookRoute({
    hook: 'saas.app.identity.organizationList',
    description:
      'RBAC 组织/租户列表查询 :: 仅按 q 模糊匹配 name/code; 默认按 createdAt 倒序返回未软删组织',
    args: [onRbacOrganizationListInput],
  })
  async list(@Query() query: QueryOrganizationDto) {
    return await this.orgService.list(query);
  }

  @Post()
  @CheckAbility('create', 'organization')
  @HookRoute({
    hook: 'saas.app.identity.organizationCreate',
    description: 'RBAC 组织创建 :: code 不强制唯一 (业务自管), 创建即激活',
    args: [onRbacOrganizationCreateInput],
  })
  async create(@Body() dto: CreateOrganizationDto) {
    return await this.orgService.create(dto);
  }

  @Put(':id')
  @CheckAbility('update', 'organization')
  @HookRoute({
    hook: 'saas.app.identity.organizationUpdate',
    description: 'RBAC 组织更新',
    args: [idParamInput.shape.id, onRbacOrganizationUpdateInput],
  })
  async update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    await this.orgService.update(id, dto);
    return { success: true } as const;
  }

  @Delete(':id')
  @CheckAbility('delete', 'organization')
  @HookRoute({
    hook: 'saas.app.identity.organizationDelete',
    description:
      'RBAC 组织软删除 :: 同时置 active=false; 旗下成员/角色不会级联清理, 业务层需自行处理',
    args: [idParamInput.shape.id],
  })
  async delete(@Param('id') id: string) {
    await this.orgService.delete(id);
    return { success: true } as const;
  }
}
