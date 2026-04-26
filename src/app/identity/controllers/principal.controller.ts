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
import { PrincipalService } from '../services/principal.service';
import { CheckAbility } from '../decorators/check-ability.decorator';
import { HookLifecycle } from '@/core/hookbus/decorators/hook-lifecycle.decorator';
import type {
  QueryPrincipalDto,
  CreatePrincipalDto,
  UpdatePrincipalDto,
} from '../types/identity.types';

/**
 * @title Principal Hook payload schema (input 形状, SSOT)
 * @keywords-cn PrincipalHook, payloadSchema, input
 * @keywords-en principal-hook, payload-schema, input
 */
const principalTypeSchema = z.enum([
  'user',
  'user_consumer',
  'official_account',
  'agent',
  'system',
]);

const onRbacPrincipalListInput = z.object({
  q: z.string().optional(),
  type: principalTypeSchema.optional(),
  tenantId: z.string().optional(),
});

const onRbacPrincipalCreateInput = z.object({
  displayName: z.string(),
  principalType: principalTypeSchema,
  avatarUrl: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  tenantId: z.string().nullable().optional(),
});

const onRbacPrincipalUpdateInput = z.object({
  displayName: z.string().optional(),
  avatarUrl: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

const idParamInput = z.object({ id: z.string() });

/**
 * @title Principal 控制器
 * @description 统一主体的增删改查接口。
 * @keywords-cn 主体控制器, 用户, 官方账号
 * @keywords-en principal-controller, user, official
 */
@Controller('identity/principals')
export class PrincipalController {
  constructor(private readonly principalService: PrincipalService) {}

  @Get()
  @CheckAbility('read', 'principal')
  @HookLifecycle({
    hook: 'saas.app.identity.principalList',
    description: 'RBAC主体列表查询',
    payloadSchema: onRbacPrincipalListInput,
    payloadSource: 'query',
  })
  async list(@Query() query: QueryPrincipalDto) {
    return await this.principalService.list(query);
  }

  @Post()
  @CheckAbility('create', 'principal')
  @HookLifecycle({
    hook: 'saas.app.identity.principalCreate',
    description: 'RBAC主体创建',
    payloadSchema: onRbacPrincipalCreateInput,
    payloadSource: 'body',
  })
  async create(@Body() dto: CreatePrincipalDto) {
    return await this.principalService.create(dto);
  }

  @Put(':id')
  @CheckAbility('update', 'principal')
  @HookLifecycle({
    hook: 'saas.app.identity.principalUpdate',
    description: 'RBAC主体更新',
    payloadSchema: onRbacPrincipalUpdateInput,
    payloadSource: 'body',
  })
  async update(@Param('id') id: string, @Body() dto: UpdatePrincipalDto) {
    await this.principalService.update(id, dto);
    return { success: true } as const;
  }

  @Delete(':id')
  @CheckAbility('delete', 'principal')
  @HookLifecycle({
    hook: 'saas.app.identity.principalDelete',
    description: 'RBAC主体删除',
    payloadSchema: idParamInput,
    payloadSource: 'params',
  })
  async delete(@Param('id') id: string) {
    await this.principalService.delete(id);
    return { success: true } as const;
  }
}
