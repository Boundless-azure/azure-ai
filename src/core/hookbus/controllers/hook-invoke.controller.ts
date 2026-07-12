import { Body, Controller, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import type { Request } from 'express';
import { HookBusService } from '../services/hook.bus.service';
import { HookResultStatus } from '../enums/hook.enums';

const hookInvokeBodySchema = z.object({
  hookName: z.string(),
  payload: z.unknown().optional(),
});

type HookInvokeBody = z.infer<typeof hookInvokeBodySchema>;
type AuthedReq = Request & { user?: { id?: string; type?: string } };

/**
 * @title Hook Invoke 控制器
 * @description 前端组件通过此端点按 hookName 调用已注册 Hook，携带 JWT 鉴权。
 *              主要用于 Web Component 动态调用 Hook（如 countBoard 统计数据面板）。
 * @keywords-cn hook调用端点, 前端组件, JWT鉴权
 * @keywords-en hook-invoke-endpoint, frontend-component-call, jwt-auth
 */
@Controller('hook-invoke')
export class HookInvokeController {
  constructor(private readonly hookBus: HookBusService) {}

  /**
   * 按 hookName 调用已注册 Hook，返回第一个处理器的结果。
   * 用于前端 Web Component 通过名称动态调用 Hook（如 countBoard 统计数据面板）。
   * @keyword-cn hook按名调用, 动态调用
   * @keyword-en invoke-hook-by-name, dynamic-hook-call
   */
  @Post()
  async invoke(@Body() body: HookInvokeBody, @Req() req: AuthedReq) {
    const parsed = hookInvokeBodySchema.safeParse(body);
    if (!parsed.success) {
      return { ok: false, errorMsg: 'invalid body: ' + parsed.error.message };
    }
    const { hookName, payload } = parsed.data;
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    // @HookRoute handlers expect payload to be a SINGLE object (post single-object migration).
    // Normalise so callers can pass a plain object or omit entirely:
    //   undefined / null / []       → {}        (no-filter invocation)
    //   single-element legacy array → array[0]  (兼容旧式数组入参)
    //   plain object                → as-is
    let normalizedPayload: unknown;
    if (payload === undefined || payload === null) {
      normalizedPayload = {};
    } else if (Array.isArray(payload)) {
      normalizedPayload = payload.length > 0 ? payload[0] : {};
    } else {
      normalizedPayload = payload;
    }
    const results = await this.hookBus.emit({
      name: hookName,
      payload: normalizedPayload,
      context: {
        source: 'http',
        token,
        principalId: req.user?.id,
        principalType: req.user?.type,
      },
    });
    if (!results.length) {
      return {
        ok: false,
        errorMsg: `no handler registered for hook: ${hookName}`,
      };
    }
    const first = results[0];
    if (first.status === HookResultStatus.Error) {
      return { ok: false, errorMsg: first.error ?? 'hook error' };
    }
    return { ok: true, data: first.data };
  }
}
