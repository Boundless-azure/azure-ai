import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { z } from 'zod';
import { HookHandler } from '@/core/hookbus/decorators/hook-handler.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import type { HookEvent, HookResult } from '@/core/hookbus/types/hook.types';
import { ImMessageService } from './im-message.service';

/**
 * @title saas.app.conversation.sendMsg payload schema (SSOT)
 * @description 单一来源, schema 给 LLM JSONSchema 派生 + 运行时校验, type 由 z.infer 派生供 handler 签名复用。
 * @keywords-cn 主动发消息, payloadSchema, SSOT, zod-infer
 * @keywords-en send-msg, payload-schema, ssot, zod-infer
 */
const sendMsgSchema = z.object({
  sessionId: z.string().describe('目标 IM 会话 ID, 必填'),
  content: z.string().min(1).describe('消息正文, 必填非空'),
  senderPrincipalId: z.string().describe('发送者主体 ID, 必填'),
  replyToId: z
    .string()
    .optional()
    .describe('回复消息 ID, 可选; 同一 replyToId 最多回复 4 条'),
  messageType: z
    .enum(['text', 'notification'])
    .optional()
    .describe('消息类型, 默认 text; notification 为 AI 可见用户端隐藏的通知'),
});

type SendMsgPayload = z.infer<typeof sendMsgSchema>;

/**
 * @title IM 主动发消息 Hook 处理器
 * @description 提供 saas.app.conversation.sendMsg hook，供主动对话模式的 LLM 通过 call_hook 主动向 IM 会话发送消息。
 * @keywords-cn 主动对话, sendMsg, hook, IM消息
 * @keywords-en proactive-chat, send-msg-hook, im-message, agent-send
 */
@Injectable()
export class SendMsgHookHandlerService {
  private readonly logger = new Logger(SendMsgHookHandlerService.name);

  constructor(
    @Inject(forwardRef(() => ImMessageService))
    private readonly imMessageService: ImMessageService,
  ) {}

  /**
   * 通过 HookBus 向指定 IM 会话发送消息
   * @keyword-en send-msg-hook-handler
   */
  @HookHandler('saas.app.conversation.sendMsg', {
    pluginName: 'im',
    tags: ['im', 'proactive', 'send'],
    description:
      '向 IM 会话发送消息。messageType=text 为普通消息, notification 为 AI 可见用户端隐藏的通知。',
    payloadSchema: sendMsgSchema,
  })
  @CheckAbility('create', 'message')
  async handleSendMsg(
    event: HookEvent<SendMsgPayload>,
  ): Promise<HookResult> {
    const {
      sessionId,
      content,
      senderPrincipalId,
      replyToId,
      messageType,
    } = event.payload;

    // replyToId 存在时检查回复数量限制
    if (replyToId) {
      const MAX_REPLIES = 4;
      const replyCount = await this.imMessageService.countReplyMessages(
        sessionId,
        senderPrincipalId,
        replyToId,
      );
      if (replyCount >= MAX_REPLIES) {
        this.logger.warn(
          `[sendMsg] reply limit reached (${replyCount}/${MAX_REPLIES}) session=${sessionId} replyTo=${replyToId}`,
        );
        return {
          status: HookResultStatus.Error,
          error: `已达到单条消息最大回复数量 ${MAX_REPLIES}，请勿继续发送。`,
        };
      }
    }

    try {
      const msg = await this.imMessageService.sendMessage(
        senderPrincipalId,
        { sessionId, content, replyToId },
        {
          role: 'assistant',
          skipAgentTrigger: true,
          messageType: messageType as 'text' | 'notification' | undefined,
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
