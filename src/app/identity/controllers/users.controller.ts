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
const userPrincipalTypeSchema = z
  .enum(['user', 'user_consumer', 'system'])
  .describe(
    '可登录主体类型 :: user=企业用户, user_consumer=消费者用户, system=系统账号 (排除 agent / official_account)',
  );

const onRbacUserListInput = z.object({
  q: z
    .string()
    .optional()
    .describe('模糊匹配 displayName / email / phone (LIKE %q%)'),
  tenantId: z
    .string()
    .optional()
    .describe('按所属租户/组织 ID 过滤'),
  type: userPrincipalTypeSchema
    .optional()
    .describe('按类型过滤; 不传时默认返回 user + user_consumer + system'),
});

const onRbacUserCreateInput = z.object({
  displayName: z.string().describe('用户显示名'),
  principalType: userPrincipalTypeSchema,
  email: z.string().describe('登录邮箱; 全局唯一, 已存在会报错'),
  password: z
    .string()
    .optional()
    .describe('明文密码 (服务端会 scrypt 加盐); 留空表示暂不允许密码登录'),
  phone: z.string().nullable().optional(),
  tenantId: z.string().nullable().optional().describe('归属租户/组织 ID'),
});

const onRbacUserUpdateInput = z.object({
  displayName: z.string().optional(),
  email: z.string().optional().describe('改邮箱会同步 users 表, 仍受全局唯一约束'),
  phone: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  active: z.boolean().optional().describe('启停; 不会软删主体'),
});

const idParamInput = z.object({
  id: z.string().describe('用户 principal_id (UUID)'),
});

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
    description:
      'RBAC 可登录用户列表 (排除 agent / official_account) :: 按 q / tenantId / type 过滤; 单次最多 500 条',
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
    description:
      'RBAC 用户创建 :: 事务地写 principals + users 两表, 邮箱全局唯一; password 走 scrypt+salt; 创建 Agent 请走 saas.app.agent.* 系列',
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
    description:
      'RBAC 用户更新 :: 改 email/avatar 会同步 users 表; 此 hook 不改密码 (改密走专用流程)',
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
    description:
      'RBAC 用户软删除 :: 同时软删 principals + users 两表; 不会清理 membership, 已分配权限对象失效但仍保留行',
    payloadSchema: idParamInput,
    payloadSource: 'params',
  })
  async delete(@Param('id') id: string) {
    await this.principalService.deleteUser(id);
    return { success: true } as const;
  }
}
