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
const principalTypeSchema = z
  .enum(['user', 'user_consumer', 'official_account', 'agent', 'system'])
  .describe(
    '主体类型 :: user=企业用户, user_consumer=消费者用户, official_account=官方账号, agent=AI 智能体, system=系统账号',
  );

const onRbacPrincipalListInput = z.object({
  q: z
    .string()
    .optional()
    .describe('模糊匹配 displayName / email / phone (LIKE %q%)'),
  type: principalTypeSchema.optional().describe('按主体类型过滤'),
  tenantId: z
    .string()
    .optional()
    .describe('按所属租户/组织 ID 过滤 (Principal.tenantId)'),
});

const onRbacPrincipalCreateInput = z.object({
  displayName: z.string().describe('主体显示名'),
  principalType: principalTypeSchema,
  avatarUrl: z.string().nullable().optional().describe('头像 URL'),
  email: z.string().nullable().optional().describe('主邮箱, 系统账号建议保留'),
  phone: z.string().nullable().optional().describe('联系电话'),
  tenantId: z
    .string()
    .nullable()
    .optional()
    .describe('归属租户/组织 ID; null 表示平台级 (跨租户)'),
});

const onRbacPrincipalUpdateInput = z.object({
  displayName: z.string().optional(),
  avatarUrl: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  active: z.boolean().optional().describe('启用/停用; false 不会软删, 仅冻结登录'),
});

const idParamInput = z.object({
  id: z.string().describe('主体 principal_id (UUID)'),
});

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
    description:
      'RBAC 主体列表查询 (含全部 principalType) :: 按 q 模糊匹配 displayName/email/phone, 按 type 限定主体类型, 按 tenantId 限定租户; 仅返回未软删主体; 单次最多 500 条',
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
    description:
      'RBAC 主体创建 :: 仅插 principals 表, 不创建关联 user/agent 记录; 创建普通用户应改用 saas.app.identity.userCreate, 创建 Agent 应改用 saas.app.agent.* 系列 hook',
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
    description:
      'RBAC 主体更新 :: 主要用于改 displayName/avatar/contact 与启停; 仅写 principals 表, 不动关联 user/agent',
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
    description:
      'RBAC 主体软删除 :: 仅 principals 表 isDelete=true + active=false; 关联的 membership/user/agent 不会级联清理, 业务层需自行处理',
    payloadSchema: idParamInput,
    payloadSource: 'params',
  })
  async delete(@Param('id') id: string) {
    await this.principalService.delete(id);
    return { success: true } as const;
  }
}
