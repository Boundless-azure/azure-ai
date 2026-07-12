import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import type { HookInvocationContext } from '@/core/hookbus/types/hook.types';
import { PrincipalService } from '../services/principal.service';
import { CheckAbility } from '../decorators/check-ability.decorator';
import type {
  CreateUserDto,
  UpdateUserDto,
  QueryUsersDto,
} from '../types/identity.types';

/**
 * @title Users Hook payload schema (input 形状, SSOT)
 * @description 单对象 payload; id+body 已平铺进对象 (id+body → { id, ...body })。
 * @keywords-cn UsersHook, payloadSchema, input, 单对象payload
 * @keywords-en users-hook, payload-schema, input, single-object-payload
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
  tenantId: z.string().optional().describe('按所属租户/组织 ID 过滤'),
  type: userPrincipalTypeSchema
    .optional()
    .describe('按类型过滤; 不传时默认返回 user + user_consumer + system'),
});

const onRbacUserCountInput = z.object({
  type: userPrincipalTypeSchema.optional().describe('按类型过滤; 不传返回全部'),
  tenantId: z.string().optional().describe('按所属租户/组织 ID 过滤'),
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
  email: z
    .string()
    .optional()
    .describe('改邮箱会同步 users 表, 仍受全局唯一约束'),
  password: z
    .string()
    .optional()
    .describe('新明文密码; 留空不修改密码, 非空会重新 scrypt 加盐'),
  phone: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  active: z.boolean().optional().describe('启停; 不会软删主体'),
});

const idField = z.object({
  id: z.string().describe('用户 principal_id (UUID)'),
});

const UserUpdateHookSchema = idField.merge(onRbacUserUpdateInput);

/**
 * @title Users Hook Controller
 * @description users 控制器的 hook 声明层 (单对象 payload); 从 UsersController 迁出, HTTP 与 hook 解耦。
 *   每个 hook 直接调 PrincipalService。
 * @keywords-cn 用户Hook声明, 单对象payload
 * @keywords-en users-hook-controller, single-object-payload
 */
@Injectable()
@HookController({ pluginName: 'identity', tags: ['identity', 'user'] })
export class UsersHookController {
  constructor(private readonly principalService: PrincipalService) {}

  /**
   * 用户总数统计。
   * @keyword-cn 用户总数, 统计
   * @keyword-en user-count, count-users
   */
  @HookRoute({
    hook: 'saas.app.identity.userCount',
    description:
      '用户总数统计 :: 返回 { count: number }，支持按 type / tenantId 过滤',
    args: [onRbacUserCountInput],
  })
  @CheckAbility('read', 'principal')
  async count(
    payload: z.infer<typeof onRbacUserCountInput>,
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    return await this.principalService.countUsers(payload);
  }

  /**
   * RBAC 可登录用户列表。
   * @keyword-cn 用户列表, 企业用户
   * @keyword-en user-list, list-users
   */
  @HookRoute({
    hook: 'saas.app.identity.userList',
    description:
      'RBAC 可登录用户列表 (排除 agent / official_account) :: 按 q / tenantId / type 过滤; 单次最多 500 条',
    args: [onRbacUserListInput],
  })
  @CheckAbility('read', 'principal')
  async list(
    payload: QueryUsersDto,
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    return await this.principalService.listUsers(payload);
  }

  /**
   * RBAC 用户创建。
   * @keyword-cn 用户创建, 主体新增
   * @keyword-en user-create, create-user
   */
  @HookRoute({
    hook: 'saas.app.identity.userCreate',
    description:
      'RBAC 用户创建 :: 事务地写 principals + users 两表, 邮箱全局唯一; password 走 scrypt+salt; 创建 Agent 请走 saas.app.agent.* 系列',
    args: [onRbacUserCreateInput],
  })
  @CheckAbility('create', 'principal')
  async create(
    payload: CreateUserDto,
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    return await this.principalService.createUser(payload);
  }

  /**
   * RBAC 用户更新。
   * @keyword-cn 用户更新, 改资料
   * @keyword-en user-update, update-user
   */
  @HookRoute({
    hook: 'saas.app.identity.userUpdate',
    description:
      'RBAC 用户更新 :: 改 email/avatar 会同步 users 表; password 非空时会重置登录密码',
    args: [UserUpdateHookSchema],
  })
  @CheckAbility('update', 'principal')
  async update(
    payload: z.infer<typeof UserUpdateHookSchema>,
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    const { id, ...body } = payload;
    await this.principalService.updateUser(id, body as UpdateUserDto);
    return { success: true } as const;
  }

  /**
   * RBAC 用户软删除。
   * @keyword-cn 用户删除, 软删
   * @keyword-en user-delete, soft-delete
   */
  @HookRoute({
    hook: 'saas.app.identity.userDelete',
    description:
      'RBAC 用户软删除 :: 同时软删 principals + users 两表; 不会清理 membership, 已分配权限对象失效但仍保留行',
    args: [idField],
  })
  @CheckAbility('delete', 'principal')
  async delete(
    payload: { id: string },
    _principal: unknown,
    _context?: HookInvocationContext,
  ) {
    await this.principalService.deleteUser(payload.id);
    return { success: true } as const;
  }
}
