import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import type {
  HookInvocationContext,
  HookResult,
} from '@/core/hookbus/types/hook.types';
import { AiCallLogService } from '../services/ai-call-log.service';

/**
 * sessionId 字段 :: 跟 sessionData 系列同构, LLM 调用时留空, 服务端兜底
 * @keyword-en session-id-optional-from-ctx
 */
const sessionIdField = z
  .string()
  .optional()
  .describe(
    '目标会话 ID (LLM 留空即可, 服务端从 ctx.extras.sessionId 自动补当前会话; 仅跨会话场景显式传)',
  );

const querySchema = z.object({
  sessionId: sessionIdField,
  id: z
    .string()
    .optional()
    .describe('精确读取某条 call log 的 id; 常用于默认列表命中 title 后二次取详情'),
  search: z
    .string()
    .optional()
    .describe(
      '统一搜索字段, 同时匹配 title / hookName / payload / result 原文; 仅在已知精确 hookName、实体 id、稳定标题时使用. 留空 = 返回最近记录',
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(50)
    .optional()
    .describe('返回上限; 不传则返回当前保留的全部记录, 最多 50 条.'),
  includeDetail: z
    .boolean()
    .optional()
    .describe(
      '是否返回 payload/result 详情. 默认 false, 只返回 id/hookName/title/ts 等轻量标题列表.',
    ),
});

type QueryPayload = z.infer<typeof querySchema>;

/**
 * @title AI call_hook 历史调用查询 Hook 处理器
 * @description 给 LLM 一个明确入口查最近 50 条**成功** call_hook 日志, 用于:
 *               - "上次查过的 X" 类引用 (避免重复调用)
 *               - 历史回溯 / 调试
 *              call log 不进 enrichWithSessionRecall 注入, 仅通过本 hook 主动查.
 * @keywords-cn 调用历史, 查询, 复用查询结果
 * @keywords-en call-history, query, reuse-results
 */
@Injectable()
@HookController({
  pluginName: 'ai-call-log',
  tags: ['conversation', 'call-log'],
})
export class AiCallLogHookController {
  private readonly logger = new Logger(AiCallLogHookController.name);

  constructor(private readonly service: AiCallLogService) {}

  // ----------------------------------------------------------------
  // saas.app.conversation.callHistory.query — 查最近调用日志
  // ----------------------------------------------------------------

  /**
   * 查询最近 N 条成功 call_hook 调用记录
   * @keyword-en hook-call-history-query
   */
  @HookRoute({
    hook: 'saas.app.conversation.callHistory.query',
    description:
      '查最近 **50 条**成功 call_hook 调用日志 (硬记录, 不通过 LLM 决策, batch 内每个 entry 算 1 条; 失败项不入库). ' +
      '默认返回 { count, items: [{ id, hookName, title, ts, runnerId? }, ...] } 按时间倒序, 不含 payload/result. ' +
      '过滤参数 :: id 精确读取 / search 精确过滤 / limit (不传=全量, 上限 50) / includeDetail (true 时返回 payload/result). ' +
      '使用场景 :: ' +
      '  - 用户说"刚才你查过的 X" / "上一轮的 Y" 时, query 拿回原始 result 直接复用, 不再重复 call_hook; ' +
      '  - 调试 LLM 行为时回溯它做过的调用. ' +
      'sessionId 留空 → 服务端从 ctx 自动补 (LLM 用法).',
    args: [querySchema],
    metadata: { tags: ['call-log', 'conversation'] },
  })
  @CheckAbility('read', 'session')
  async handleQuery(
    payload: QueryPayload,
    _principal?: unknown,
    context?: HookInvocationContext,
  ): Promise<HookResult> {
    const sessionId = resolveSessionId({ payload, context });
    if (!sessionId) {
      return {
        status: HookResultStatus.Error,
        error:
          'sessionId 缺失: 请确保调用上下文 ctx.extras.sessionId 已注入, 或显式传 payload.sessionId',
      };
    }
    try {
      const items = await this.service.query(sessionId, {
        id: payload.id,
        search: payload.search,
        limit: payload.limit,
        includeDetail: payload.includeDetail,
      });
      return {
        status: HookResultStatus.Success,
        data: { count: items.length, items },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { status: HookResultStatus.Error, error: msg };
    }
  }
}

/**
 * 取 sessionId :: 跟 sessionData hook handlers 完全同构
 * @keyword-en resolve-session-id-from-ctx
 */
function resolveSessionId(event: {
  payload: { sessionId?: string };
  context?: { extras?: Record<string, unknown> };
}): string | null {
  const fromPayload = event.payload?.sessionId?.trim();
  if (fromPayload) return fromPayload;
  const fromCtx = event.context?.extras?.sessionId;
  if (typeof fromCtx === 'string' && fromCtx.trim()) return fromCtx.trim();
  return null;
}
