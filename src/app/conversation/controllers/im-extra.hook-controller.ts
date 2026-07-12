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
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { ImMessageService } from '../services/im-message.service';
import { sendMsgSchema } from './im.controller';

type SendMsgPayload = z.infer<typeof sendMsgSchema>;

/**
 * @title IM 主动发消息 Hook 声明层
 * @description im 模块主动发消息 hook 的声明层 (单对象 payload); 从 ImController 迁出, HTTP 与 hook 解耦。
 *   sessionId 从 ctx.extras.sessionId 优先, senderPrincipalId 由 ctx.principalId 强制覆盖 (禁止冒充)。
 * @keywords-cn 主动发消息Hook声明, 单对象payload
 * @keywords-en im-extra-hook-controller, single-object-payload
 */
@Injectable()
@HookController({ pluginName: 'im', tags: ['conversation', 'im', 'message'] })
export class ImExtraHookController {
  private readonly logger = new Logger(ImExtraHookController.name);

  constructor(private readonly messageService: ImMessageService) {}

  /**
   * 通过 HookBus 向指定 IM 会话发送消息。
   * @keyword-cn 主动发消息
   * @keyword-en send-msg, proactive, reply-to-id
   */
  @HookRoute({
    hook: 'saas.app.conversation.sendMsg',
    description:
      '向 IM 会话发送消息。messageType=text 为普通消息, notification 为 AI 可见用户端隐藏的通知。',
    args: [sendMsgSchema],
    metadata: { tags: ['im', 'proactive', 'send'] },
  })
  @CheckAbility('create', 'message')
  async handleSendMsg(
    payload: SendMsgPayload,
    _principal?: unknown,
    context?: HookInvocationContext,
  ): Promise<HookResult> {
    const {
      sessionId: payloadSessionId,
      content,
      senderPrincipalId: payloadSenderPrincipalId,
      replyToId,
      messageType,
      mentions,
      strictMention,
    } = payload;

    // sessionId :: ctx.extras.sessionId 优先, payload 兜底 (兼容外部 curl 调用)
    const ctxSessionId =
      typeof context?.extras?.sessionId === 'string'
        ? context.extras.sessionId.trim()
        : '';
    const sessionId = ctxSessionId || payloadSessionId?.trim() || '';
    if (!sessionId) {
      return {
        status: HookResultStatus.Error,
        error:
          'sessionId 缺失 :: LLM 留空即可, 服务端会从 ctx.extras.sessionId 自动补; 外部调用方需显式传 sessionId.',
      };
    }

    // senderPrincipalId :: LLM 链路强制使用 ctx.principalId, 禁止冒充其他主体发消息
    //  - 外部 curl / 系统内部调用 (无 llm context) 可保留 payload 字段
    const ctxPrincipalId = context?.principalId?.trim() ?? '';
    const isLlmCall = context?.source === 'llm';
    if (
      isLlmCall &&
      payloadSenderPrincipalId &&
      payloadSenderPrincipalId !== ctxPrincipalId
    ) {
      this.logger.warn(
        `[sendMsg] senderPrincipalId override (impersonation blocked) session=${sessionId} payload=${payloadSenderPrincipalId} ctx=${ctxPrincipalId}`,
      );
    }
    const senderPrincipalId = isLlmCall
      ? ctxPrincipalId
      : payloadSenderPrincipalId?.trim() || ctxPrincipalId;
    if (!senderPrincipalId) {
      return {
        status: HookResultStatus.Error,
        error:
          'senderPrincipalId 缺失 :: LLM 链路从 ctx.principalId 自动取, 外部调用方需显式传 senderPrincipalId.',
      };
    }

    const contextReplyToId =
      isLlmCall && typeof context?.extras?.triggerMessageId === 'string'
        ? context.extras.triggerMessageId
        : null;
    const effectiveReplyToId = contextReplyToId ?? replyToId;
    if (contextReplyToId && replyToId && replyToId !== contextReplyToId) {
      this.logger.warn(
        `[sendMsg] replyToId overridden by llm context session=${sessionId} payload=${replyToId} context=${contextReplyToId}`,
      );
    }

    if (effectiveReplyToId) {
      const maxReplies = 4;
      const replyCount = await this.messageService.countReplyMessages(
        sessionId,
        senderPrincipalId,
        effectiveReplyToId,
      );
      if (replyCount >= maxReplies) {
        this.logger.warn(
          `[sendMsg] reply limit reached (${replyCount}/${maxReplies}) session=${sessionId} replyTo=${effectiveReplyToId}`,
        );
        return {
          status: HookResultStatus.Error,
          error: `已达到单条消息最大回复数量 ${maxReplies}，请勿继续发送。`,
        };
      }
    }

    try {
      const msg = await this.messageService.sendMessage(
        senderPrincipalId,
        {
          sessionId,
          content,
          replyToId: effectiveReplyToId,
          ...(mentions && mentions.length > 0
            ? {
                mentions: mentions.map((principalId) => ({
                  principalId,
                  mentionText: '',
                  startIndex: 0,
                  endIndex: 0,
                })),
              }
            : {}),
          ...(strictMention === true ? { strictMention: true } : {}),
        },
        {
          role: 'assistant',
          skipAgentTrigger: !mentions || mentions.length === 0 ? true : false,
          messageType: messageType,
        },
      );
      this.logger.debug(
        `[sendMsg] sent to session=${sessionId} by=${senderPrincipalId} type=${messageType ?? 'text'}`,
      );
      return {
        status: HookResultStatus.Success,
        data: { messageId: msg.id, sessionId },
      };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.logger.warn(`[sendMsg] failed session=${sessionId}: ${err}`);
      return { status: HookResultStatus.Error, error: err };
    }
  }
}
