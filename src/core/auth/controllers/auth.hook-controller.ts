import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import type {
  HookInvocationContext,
  HookResult,
} from '@/core/hookbus/types/hook.types';
import { AuthService } from '../services/auth.service';

/**
 * @title 鉴权 Hook payload schema (SSOT)
 * @description 登录/密码相关系统事件 hook 的参数 schema (单对象 payload); 从 AuthController 迁出。
 * @keywords-cn 鉴权Hook, payloadSchema, SSOT
 * @keywords-en auth-hook, payload-schema, ssot
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
 * @title Auth Hook Controller
 * @description auth 模块的 hook 声明层 (单对象 payload); 从 AuthController 迁出, HTTP 与 hook 解耦。
 *   均为系统触发的事件 hook, 非 AI 主动调用, 故不挂 @CheckAbility。
 * @keywords-cn 鉴权Hook声明, 单对象payload
 * @keywords-en auth-hook-controller, single-object-payload
 */
@Injectable()
@HookController({ pluginName: 'auth' })
export class AuthHookController {
  private readonly logger = new Logger(AuthHookController.name);

  constructor(private readonly auth: AuthService) {}

  /**
   * 登录成功事件 Hook（系统触发，非 AI 主动调用）。
   * @keyword-cn 登录成功事件
   * @keyword-en auth-login-success-hook
   */
  @HookRoute({
    hook: 'saas.app.auth.loginSuccess',
    description: '登录成功事件 Hook（系统触发，非 AI 主动调用）。',
    args: [onAuthLoginSuccessSchema],
    metadata: { tags: ['auth', 'login', 'success'] },
  })
  handleLoginSuccess(
    payload: OnAuthLoginSuccessPayload,
    _principal?: unknown,
    _context?: HookInvocationContext,
  ): HookResult {
    const { principalId, userId, loginAt } = payload;
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

  /**
   * 登录失败事件 Hook（系统触发，非 AI 主动调用）。
   * @keyword-cn 登录失败事件
   * @keyword-en auth-login-failed-hook
   */
  @HookRoute({
    hook: 'saas.app.auth.loginFailed',
    description: '登录失败事件 Hook（系统触发，非 AI 主动调用）。',
    args: [onAuthLoginFailedSchema],
    metadata: { tags: ['auth', 'login', 'failed'] },
  })
  handleLoginFailed(
    payload: OnAuthLoginFailedPayload,
    _principal?: unknown,
    _context?: HookInvocationContext,
  ): HookResult {
    const { identifier, reason } = payload;
    return {
      status: HookResultStatus.Success,
      data: {
        identifier,
        reason,
        processedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * 密码变更事件 Hook（系统触发，非 AI 主动调用）。
   * @keyword-cn 密码变更事件
   * @keyword-en auth-password-changed-hook
   */
  @HookRoute({
    hook: 'saas.app.auth.passwordChanged',
    description: '密码变更事件 Hook（系统触发，非 AI 主动调用）。',
    args: [onAuthPasswordChangedSchema],
    metadata: { tags: ['auth', 'password', 'change'] },
  })
  handlePasswordChanged(
    payload: OnAuthPasswordChangedPayload,
    _principal?: unknown,
    _context?: HookInvocationContext,
  ): HookResult {
    const { principalId, ok } = payload;
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
