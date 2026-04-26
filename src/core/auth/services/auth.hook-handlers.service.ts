import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { HookHandler } from '@/core/hookbus/decorators/hook-handler.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import type { HookEvent, HookResult } from '@/core/hookbus/types/hook.types';

/**
 * @title 鉴权 Hook payload schema (SSOT)
 * @description 单一来源: schema 给装饰器用作运行时校验, type 由 z.infer 派生供 handler 签名复用。
 *              这三个 hook 是系统触发, 非 LLM 主动调用, schema 也用于挡住 emit 端的脏数据。
 * @keywords-cn 鉴权Hook, payloadSchema, SSOT, zod-infer
 * @keywords-en auth-hook, payload-schema, ssot, zod-infer
 */
const onAuthLoginSuccessSchema = z.object({
  principalId: z.string().describe('主体 ID, 必填'),
  userId: z.string().describe('用户 ID, 必填'),
  loginAt: z.string().optional().describe('登录时间 ISO 串, 可选'),
});

const onAuthLoginFailedSchema = z.object({
  identifier: z.string().describe('登录凭据标识 (用户名/邮箱), 必填'),
  reason: z.string().describe('失败原因, 必填'),
});

const onAuthPasswordChangedSchema = z.object({
  principalId: z.string().describe('主体 ID, 必填'),
  ok: z.boolean().describe('密码变更是否成功'),
});

type OnAuthLoginSuccessPayload = z.infer<typeof onAuthLoginSuccessSchema>;
type OnAuthLoginFailedPayload = z.infer<typeof onAuthLoginFailedSchema>;
type OnAuthPasswordChangedPayload = z.infer<typeof onAuthPasswordChangedSchema>;

/**
 * @title 鉴权 Hook 处理器
 * @description 提供鉴权相关 Hook 的默认处理器占位注册。
 * @keywords-cn 鉴权Hook, 登录, 密码变更
 * @keywords-en auth-hook, login, password-change
 */
@Injectable()
export class AuthHookHandlersService {
  @HookHandler('saas.app.auth.loginSuccess', {
    pluginName: 'auth',
    tags: ['auth', 'login', 'success'],
    description: '登录成功事件 Hook（系统触发，非 AI 主动调用）。',
    payloadSchema: onAuthLoginSuccessSchema,
  })
  handleLoginSuccess(
    event: HookEvent<OnAuthLoginSuccessPayload>,
  ): HookResult {
    const { principalId, userId, loginAt } = event.payload;
    return {
      status: HookResultStatus.Success,
      data: {
        principalId,
        userId,
        loginAt: loginAt ?? new Date().toISOString(),
        processedAt: new Date().toISOString(),
      },
    };
  }

  @HookHandler('saas.app.auth.loginFailed', {
    pluginName: 'auth',
    tags: ['auth', 'login', 'failed'],
    description: '登录失败事件 Hook（系统触发，非 AI 主动调用）。',
    payloadSchema: onAuthLoginFailedSchema,
  })
  handleLoginFailed(
    event: HookEvent<OnAuthLoginFailedPayload>,
  ): HookResult {
    const { identifier, reason } = event.payload;
    return {
      status: HookResultStatus.Success,
      data: {
        identifier,
        reason,
        processedAt: new Date().toISOString(),
      },
    };
  }

  @HookHandler('saas.app.auth.passwordChanged', {
    pluginName: 'auth',
    tags: ['auth', 'password', 'change'],
    description: '密码变更事件 Hook（系统触发，非 AI 主动调用）。',
    payloadSchema: onAuthPasswordChangedSchema,
  })
  handlePasswordChanged(
    event: HookEvent<OnAuthPasswordChangedPayload>,
  ): HookResult {
    const { principalId, ok } = event.payload;
    return {
      status: HookResultStatus.Success,
      data: {
        principalId,
        ok,
        processedAt: new Date().toISOString(),
      },
    };
  }
}
