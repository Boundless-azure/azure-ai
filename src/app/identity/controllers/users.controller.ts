import {
  Controller,
  Get,
  Query,
  Post,
  Body,
  Put,
  Param,
  Delete,
} from '@nestjs/common';
import { z } from 'zod';
import { PrincipalService } from '../services/principal.service';
import { CheckAbility } from '../decorators/check-ability.decorator';
import { HookLifecycle } from '@/core/hookbus/decorators/hook-lifecycle.decorator';
import type {
  CreateUserDto,
  UpdateUserDto,
  QueryUsersDto,
} from '../types/identity.types';

/**
 * @title Users Hook payload schema (input 形状, SSOT)
 * @description 仅声明 input 部分, lifecycle-registration 自动包成 envelope schema 写入 metadata。
 * @keywords-cn UsersHook, payloadSchema, input
 * @keywords-en users-hook, payload-schema, input
 */
const userPrincipalTypeSchema = z.enum(['user', 'user_consumer', 'system']);

const onRbacUserListInput = z.object({
  q: z.string().optional(),
  tenantId: z.string().optional(),
  type: userPrincipalTypeSchema.optional(),
});

const onRbacUserCreateInput = z.object({
  displayName: z.string(),
  principalType: userPrincipalTypeSchema,
  email: z.string(),
  password: z.string().optional(),
  phone: z.string().nullable().optional(),
  tenantId: z.string().nullable().optional(),
});

const onRbacUserUpdateInput = z.object({
  displayName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

const idParamInput = z.object({ id: z.string() });

/**
 * @title Users 控制器
 * @description 仅返回用户主体（企业/消费者）的列表接口。
 * @keywords-cn 用户列表, 企业用户, 消费者
 * @keywords-en users-controller, enterprise-user, consumer
 */
@Controller('identity/users')
export class UsersController {
  constructor(private readonly principalService: PrincipalService) {}

  @Get()
  @CheckAbility('read', 'principal')
  @HookLifecycle({
    hook: 'saas.app.identity.userList',
    description: 'RBAC用户列表查询',
    payloadSchema: onRbacUserListInput,
    payloadSource: 'query',
  })
  async list(@Query() query: QueryUsersDto) {
    return await this.principalService.listUsers(query);
  }

  @Post()
  @CheckAbility('create', 'principal')
  @HookLifecycle({
    hook: 'saas.app.identity.userCreate',
    description: 'RBAC用户创建',
    payloadSchema: onRbacUserCreateInput,
    payloadSource: 'body',
  })
  async create(@Body() dto: CreateUserDto) {
    return await this.principalService.createUser(dto);
  }

  @Put(':id')
  @CheckAbility('update', 'principal')
  @HookLifecycle({
    hook: 'saas.app.identity.userUpdate',
    description: 'RBAC用户更新',
    payloadSchema: onRbacUserUpdateInput,
    payloadSource: 'body',
  })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    await this.principalService.updateUser(id, dto);
    return { success: true } as const;
  }

  @Delete(':id')
  @CheckAbility('delete', 'principal')
  @HookLifecycle({
    hook: 'saas.app.identity.userDelete',
    description: 'RBAC用户删除',
    payloadSchema: idParamInput,
    payloadSource: 'params',
  })
  async delete(@Param('id') id: string) {
    await this.principalService.deleteUser(id);
    return { success: true } as const;
  }
}
