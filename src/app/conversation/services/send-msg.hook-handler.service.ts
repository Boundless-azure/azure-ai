import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { HookHandler } from '@/core/hookbus/decorators/hook-handler.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import type { HookEvent, HookResult } from '@/core/hookbus/types/hook.types';
import { ImMessageService } from './im-message.service';

/**
 * @title IM 主动发消息 Hook 处理器
 * @description 提供 send_msg hook，供主动对话模式的 LLM 通过 call_hook 主动向 IM 会话发送消息。
 *              payload: { sessionId, content, senderPrincipalId, replyToId }
 * @keywords-cn 主动对话, sendMsg, hook, IM消息
 * @keywords-en proactive-chat, send-msg-hook, im-message, agent-send
 */
@Injectable()
export class SendMsgHookHandlerService {
  private readonly logger = new Logger(SendMsgHookHandlerService.name);

  constructor(
    @Inject(forwardRef(() => ImMessageService))
    private readonly imMessageService: ImMessageService,
  ) { }

  /**
   * 通过 HookBus 向指定 IM 会话发送消息
   * payload: { sessionId: string; content: string; senderPrincipalId: string; replyToId: string }
   * replyToId 为触发本轮 AI 回复的用户消息 ID（必填），用于关联溯源和判断本轮是否已回复
   * @keyword-en send-msg-hook-handler
   */
  @HookHandler('send_msg', {
    pluginName: 'im',
    tags: ['im', 'proactive', 'send'],
    description: '向 IM 会话发送 assistant 消息（主动对话专用）。payload: { sessionId: string, content: string, senderPrincipalId: string, replyToId: string }。所有字段必填。replyToId 必须是本轮触发消息的 ID，用于溯源与防重；同一 replyToId 最多回复 4 条。',
  })
  async handleSendMsg(
    event: HookEvent<{ sessionId?: string; content?: string; senderPrincipalId?: string; replyToId?: string }>,
  ): Promise<HookResult> {
    const { sessionId, content, senderPrincipalId, replyToId } = event.payload ?? {};

    if (!sessionId || !content || !senderPrincipalId || !replyToId) {
      return {
        status: HookResultStatus.Error,
        error: 'sessionId, content, senderPrincipalId, replyToId are required',
      };
    }

    // 硬性限制：同一 triggerMessage 最多回复 4 条
    const MAX_REPLIES = 4;
    const replyCount = await this.imMessageService.countReplyMessages(sessionId, senderPrincipalId, replyToId);
    if (replyCount >= MAX_REPLIES) {
      this.logger.warn(`[send_msg] reply limit reached (${replyCount}/${MAX_REPLIES}) session=${sessionId} replyTo=${replyToId}`);
      return {
        status: HookResultStatus.Error,
        error: `已达到单条消息最大回复数量 ${MAX_REPLIES}，请勿继续发送。`,
      };
    }

    try {
      const msg = await this.imMessageService.sendMessage(
        senderPrincipalId,
        { sessionId, content, replyToId },
        { role: 'assistant', skipAgentTrigger: true },
      );
      this.logger.debug(`[send_msg] sent to session=${sessionId} by=${senderPrincipalId} replyTo=${replyToId}`);
      return { status: HookResultStatus.Success, data: { messageId: msg.id, sessionId } };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.logger.warn(`[send_msg] failed session=${sessionId}: ${err}`);
      return { status: HookResultStatus.Error, error: err };
    }
  }
}
