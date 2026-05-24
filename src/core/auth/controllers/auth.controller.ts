import { Body, Controller, Post, HttpCode, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { Public } from '../decorators/public.decorator';
import { CurrentPrincipal } from '../decorators/current-principal.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AuthService } from '../services/auth.service';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import type { HookResult } from '@/core/hookbus/types/hook.types';
import type {
  ChangePasswordDto,
  JwtPayload,
  LoginDto,
  LoginResponse,
} from '../types/auth.types';

/**
 * @title 鉴权 Hook payload schema (SSOT)
 * @description 登录/密码相关系统事件 hook 的参数 schema, 与 AuthController 内 HookRoute 共用。
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
 * @title 认证控制器
 * @description 提供登录/修改密码 HTTP 接口, 并在同一控制器声明鉴权相关系统事件 Hook。
 * @keywords-cn 认证控制器, 登录, JWT, Hook
 * @keywords-en auth-controller, login, jwt, hook
 */
@HookController({ pluginName: 'auth' })
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return await this.auth.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @CurrentPrincipal() principal: JwtPayload | undefined,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.auth.changePassword(principal?.id || '', dto);
    return { success: true } as const;
  }

  /**
   * 登录成功事件 Hook（系统触发，非 AI 主动调用）。
   * @keyword-en auth-login-success-hook
   */
  @HookRoute({
    hook: 'saas.app.auth.loginSuccess',
    description: '登录成功事件 Hook（系统触发，非 AI 主动调用）。',
    args: [onAuthLoginSuccessSchema],
    metadata: { tags: ['auth', 'login', 'success'] },
  })
  handleLoginSuccess(payload: OnAuthLoginSuccessPayload): HookResult {
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
   * @keyword-en auth-login-failed-hook
   */
  @HookRoute({
    hook: 'saas.app.auth.loginFailed',
    description: '登录失败事件 Hook（系统触发，非 AI 主动调用）。',
    args: [onAuthLoginFailedSchema],
    metadata: { tags: ['auth', 'login', 'failed'] },
  })
  handleLoginFailed(payload: OnAuthLoginFailedPayload): HookResult {
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
   * @keyword-en auth-password-changed-hook
   */
  @HookRoute({
    hook: 'saas.app.auth.passwordChanged',
    description: '密码变更事件 Hook（系统触发，非 AI 主动调用）。',
    args: [onAuthPasswordChangedSchema],
    metadata: { tags: ['auth', 'password', 'change'] },
  })
  handlePasswordChanged(payload: OnAuthPasswordChangedPayload): HookResult {
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
