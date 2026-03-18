import { Injectable } from '@nestjs/common';
import { HookHandler } from '@/core/hookbus/decorators/hook-handler.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import type { HookContext, HookResult } from '@/core/hookbus/types/hook.types';

/**
 * @title 鉴权 Hook 处理器
 * @description 提供鉴权相关 Hook 的默认处理器占位注册。
 * @keywords-cn 鉴权Hook, 登录, 密码变更
 * @keywords-en auth-hook, login, password-change
 */
@Injectable()
export class AuthHookHandlersService {
  @HookHandler('onAuthLoginSuccess', {
    pluginName: 'auth',
    tags: ['auth', 'login', 'success'],
  })
  handleLoginSuccess(
    ctx: HookContext<{
      principalId?: string;
      userId?: string;
      loginAt?: string;
    }>,
  ): HookResult {
    const payload = ctx.event.payload ?? {};
    if (!payload.principalId || !payload.userId) {
      return {
        status: HookResultStatus.Error,
        error: 'principalId and userId are required',
        data: payload,
      };
    }
    return {
      status: HookResultStatus.Success,
      data: {
        principalId: payload.principalId,
        userId: payload.userId,
        loginAt: payload.loginAt ?? new Date().toISOString(),
        processedAt: new Date().toISOString(),
      },
    };
  }

  @HookHandler('onAuthLoginFailed', {
    pluginName: 'auth',
    tags: ['auth', 'login', 'failed'],
  })
  handleLoginFailed(
    ctx: HookContext<{ identifier?: string; reason?: string }>,
  ): HookResult {
    const payload = ctx.event.payload ?? {};
    if (!payload.identifier || !payload.reason) {
      return {
        status: HookResultStatus.Error,
        error: 'identifier and reason are required',
        data: payload,
      };
    }
    return {
      status: HookResultStatus.Success,
      data: {
        identifier: payload.identifier,
        reason: payload.reason,
        processedAt: new Date().toISOString(),
      },
    };
  }

  @HookHandler('onAuthPasswordChanged', {
    pluginName: 'auth',
    tags: ['auth', 'password', 'change'],
  })
  handlePasswordChanged(
    ctx: HookContext<{ principalId?: string; ok?: boolean }>,
  ): HookResult {
    const payload = ctx.event.payload ?? {};
    if (!payload.principalId) {
      return {
        status: HookResultStatus.Error,
        error: 'principalId is required',
        data: payload,
      };
    }
    return {
      status: HookResultStatus.Success,
      data: {
        principalId: payload.principalId,
        ok: Boolean(payload.ok),
        processedAt: new Date().toISOString(),
      },
    };
  }
}
