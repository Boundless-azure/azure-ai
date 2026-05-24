import { Injectable } from '@nestjs/common';
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
import {
  CurrentSessionService,
  type CurrentSessionPendingAction,
} from '../services/current-session.service';

/**
 * sessionId 字段 :: LLM 留空时从 invocationContext.extras.sessionId 取。
 * @keyword-en current-session-id-from-ctx
 */
const sessionIdField = z
  .string()
  .optional()
  .describe('目标会话 ID; LLM 留空即可, 服务端从 ctx.extras.sessionId 自动补');

/**
 * currentSession.set payload schema。
 * @keyword-en current-session-set-schema
 */
const setSchema = z.object({
  sessionId: sessionIdField,
  fields: z
    .record(z.string(), z.unknown())
    .describe('要合并进当前会话临时态的字段; 仅内存保存, 不落库'),
});

/**
 * currentSession.get payload schema。
 * @keyword-en current-session-get-schema
 */
const getSchema = z.object({
  sessionId: sessionIdField,
});

/**
 * currentSession.context payload schema; sessionId 留空时从 ctx.extras.sessionId 自动补.
 * @keyword-en current-session-context-schema
 */
const contextSchema = z.object({
  sessionId: sessionIdField,
});

/**
 * currentSession.setPendingAction payload schema。
 * @keyword-en current-session-pending-action-schema
 */
const pendingActionSchema = z.object({
  sessionId: sessionIdField,
  stage: z
    .enum(['missing_args', 'ready', 'not_found'])
    .describe(
      '挂起阶段: missing_args=参数不足需追问; ready=参数已齐可执行; not_found=未找到可用能力',
    ),
  hookName: z.string().optional().describe('已确认或候选的业务 hook 名称'),
  domain: z.string().optional().describe('业务域, 如 identity.user / todo'),
  action: z.string().optional().describe('动作, 如 create / update / delete'),
  missingFields: z
    .array(z.string())
    .optional()
    .describe('仍缺少的必填字段名; missing_args 时必须尽量填写'),
  collectedFields: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('已经从用户上下文收集到的字段'),
  question: z
    .string()
    .optional()
    .describe('准备通过 sendMsg 追问用户的具体问题'),
  reason: z.string().optional().describe('为什么挂起或无法继续'),
});

/**
 * currentSession.clearPendingAction payload schema。
 * @keyword-en current-session-clear-pending-action-schema
 */
const clearPendingActionSchema = z.object({
  sessionId: sessionIdField,
});

type SetPayload = z.infer<typeof setSchema>;
type GetPayload = z.infer<typeof getSchema>;
type ContextPayload = z.infer<typeof contextSchema>;
type PendingActionPayload = z.infer<typeof pendingActionSchema>;
type ClearPendingActionPayload = z.infer<typeof clearPendingActionSchema>;

/**
 * @title Current Session Hook 处理器
 * @description 提供当前会话临时字段 + pendingAction 挂起态; init_tip 已提升为 top-level tool (见 init-tip.tool.ts), 不再走 hook 路由. 数据仅保存在单进程内存, 不进入 session_data。
 * @keywords-cn 当前会话, 临时字段, 工具判定, 防偷懒
 * @keywords-en current-session, temp-fields, tool-guard, lazy-guard
 */
@Injectable()
@HookController({
  pluginName: 'current-session',
  tags: ['conversation', 'current-session'],
})
export class CurrentSessionHookController {
  constructor(private readonly service: CurrentSessionService) {}

  /**
   * 设置当前会话临时字段。
   * @keyword-en hook-current-session-set
   */
  @HookRoute({
    hook: 'saas.app.conversation.currentSession.set',
    description:
      '设置当前会话临时字段 (只存内存, 不落库, 不替代 sessionData/callHistory)。' +
      'sessionId 留空时从 ctx.extras.sessionId 自动补。适合保存本轮规划/临时开关。',
    args: [setSchema],
    metadata: { tags: ['conversation', 'current-session'] },
  })
  @CheckAbility('update', 'session')
  handleSet(
    payload: SetPayload,
    _principal?: unknown,
    context?: HookInvocationContext,
  ): HookResult {
    const resolved = resolveSessionScope({ payload, context });
    if (!resolved) return missingSessionResult();
    const data = this.service.setFields(
      resolved.sessionId,
      resolved.principalId,
      payload.fields,
    );
    return { status: HookResultStatus.Success, data };
  }

  /**
   * 读取当前会话临时字段和本轮判定状态。
   * @keyword-en hook-current-session-get
   */
  @HookRoute({
    hook: 'saas.app.conversation.currentSession.get',
    description:
      '读取当前会话临时态快照, 返回 fields / initTip / pendingAction / hookCalls。' +
      '这是调试和规划用状态, 不代表真实业务数据。',
    args: [getSchema],
    metadata: { tags: ['conversation', 'current-session'] },
  })
  @CheckAbility('read', 'session')
  handleGet(
    payload: GetPayload,
    _principal?: unknown,
    context?: HookInvocationContext,
  ): HookResult {
    const resolved = resolveSessionScope({ payload, context });
    if (!resolved) return missingSessionResult();
    const data = this.service.snapshot(
      resolved.sessionId,
      resolved.principalId,
    );
    return { status: HookResultStatus.Success, data };
  }

  /**
   * 读取当前会话完整上下文 :: 双方主体 + peer IP + 会话元数据 + 服务器时间.
   * @keyword-en hook-current-session-context
   */
  @HookRoute({
    hook: 'saas.app.conversation.currentSession.context',
    description:
      '读取当前会话上下文快照, 返回 { me, peer, session, time }: ' +
      'me / peer 含 principalId + principalType + displayName + tenantId; ' +
      'peer 还含 ip (来自最近触发端 HTTP 请求) + lastMessageId + lastMessageAt; ' +
      'session 含 type / name / creatorId / memberCount / members[]; ' +
      'time 含 iso / epochMs / timezone / weekday. ' +
      'sessionId 留空即可, 服务端从 ctx.extras.sessionId 自动补. ' +
      '私聊 peer = 另一成员; 群聊 peer = 最近一条非自己/非系统消息的 sender.',
    args: [contextSchema],
    metadata: { tags: ['conversation', 'current-session', 'context'] },
  })
  @CheckAbility('read', 'session')
  async handleContext(
    payload: ContextPayload,
    _principal?: unknown,
    context?: HookInvocationContext,
  ): Promise<HookResult> {
    const resolved = resolveSessionScope({ payload, context });
    if (!resolved) return missingSessionResult();
    try {
      const data = await this.service.getContextSnapshot(
        resolved.sessionId,
        resolved.principalId,
      );
      return { status: HookResultStatus.Success, data };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        status: HookResultStatus.Error,
        error: `获取会话上下文失败: ${msg}`,
      };
    }
  }

  /**
   * 设置待补参数/待确认的平台动作。
   * @keyword-en hook-current-session-set-pending-action
   */
  @HookRoute({
    hook: 'saas.app.conversation.currentSession.setPendingAction',
    description:
      '设置当前会话挂起的平台动作。用于 needHook=true 但业务 hook 参数不足时: ' +
      '先确认/候选 hook 与缺失字段, 写 stage=missing_args、missingFields、question, 再通过 sendMsg 追问用户。' +
      '如果发现平台无对应能力, 写 stage=not_found、reason, 再通过 sendMsg 告知限制。' +
      '该状态只存内存, 下一轮用户补参数时可用 currentSession.get 读取并继续执行。',
    args: [pendingActionSchema],
    metadata: {
      tags: ['conversation', 'current-session', 'pending-action'],
    },
  })
  @CheckAbility('update', 'session')
  handleSetPendingAction(
    payload: PendingActionPayload,
    _principal?: unknown,
    context?: HookInvocationContext,
  ): HookResult {
    const resolved = resolveSessionScope({ payload, context });
    if (!resolved) return missingSessionResult();
    const pendingAction: CurrentSessionPendingAction = {
      stage: payload.stage,
      missingFields: payload.missingFields ?? [],
      collectedFields: payload.collectedFields ?? {},
      ...(payload.hookName ? { hookName: payload.hookName } : {}),
      ...(payload.domain ? { domain: payload.domain } : {}),
      ...(payload.action ? { action: payload.action } : {}),
      ...(payload.question ? { question: payload.question } : {}),
      ...(payload.reason ? { reason: payload.reason } : {}),
    };
    const data = this.service.setPendingAction(
      resolved.sessionId,
      resolved.principalId,
      pendingAction,
    );
    return { status: HookResultStatus.Success, data };
  }

  /**
   * 清除当前会话挂起的平台动作。
   * @keyword-en hook-current-session-clear-pending-action
   */
  @HookRoute({
    hook: 'saas.app.conversation.currentSession.clearPendingAction',
    description:
      '清除 currentSession.pendingAction。通常在业务 hook 已成功执行或用户取消待办动作后调用。',
    args: [clearPendingActionSchema],
    metadata: {
      tags: ['conversation', 'current-session', 'pending-action'],
    },
  })
  @CheckAbility('update', 'session')
  handleClearPendingAction(
    payload: ClearPendingActionPayload,
    _principal?: unknown,
    context?: HookInvocationContext,
  ): HookResult {
    const resolved = resolveSessionScope({ payload, context });
    if (!resolved) return missingSessionResult();
    const data = this.service.clearPendingAction(
      resolved.sessionId,
      resolved.principalId,
    );
    return { status: HookResultStatus.Success, data };
  }
}

/**
 * 解析当前 session/principal 作用域。
 * @keyword-en resolve-current-session-scope
 */
function resolveSessionScope(event: {
  payload: { sessionId?: string };
  context?: HookInvocationContext;
}): { sessionId: string; principalId: string } | null {
  const fromPayload = event.payload.sessionId?.trim();
  const fromCtx = event.context?.extras?.sessionId;
  const sessionId =
    fromPayload ||
    (typeof fromCtx === 'string' && fromCtx.trim() ? fromCtx.trim() : '');
  const principalId = event.context?.principalId?.trim() ?? '';
  if (!sessionId || !principalId) return null;
  return { sessionId, principalId };
}

/**
 * 缺少 session/principal 时的统一错误。
 * @keyword-en current-session-missing-scope-result
 */
function missingSessionResult(): HookResult {
  return {
    status: HookResultStatus.Error,
    error:
      'sessionId/principalId 缺失: 请确保 ctx.extras.sessionId 和 ctx.principalId 已注入, 或显式传 payload.sessionId',
  };
}
