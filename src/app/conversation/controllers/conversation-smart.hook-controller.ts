import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import { z } from 'zod';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import type { HookEvent, HookResult } from '@/core/hookbus/types/hook.types';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { ChatSessionSmartEntity } from '@core/ai/entities/chat-session-smart.entity';
import { ChatMessageEntity } from '@core/ai/entities/chat-message.entity';
import {
  smartTagsSchema,
  smartSearchSchema,
  smartMessagesSchema,
  flattenKeywords,
} from './conversation.controller';

type SmartTagsPayload = z.infer<typeof smartTagsSchema>;
type SmartSearchPayload = z.infer<typeof smartSearchSchema>;
type SmartMessagesPayload = z.infer<typeof smartMessagesSchema>;

/**
 * @title Smart 历史检索 Hook 声明层
 * @description conversation 模块三步 smart 历史检索 hook 的声明层 (单对象 payload); 从 ConversationController 迁出, HTTP 与 hook 解耦。
 *   直接注入 chat_session_smart / chat_message 仓库查询。
 * @keywords-cn Smart检索Hook声明, 单对象payload, 分层历史检索
 * @keywords-en smart-history-hook-controller, single-object-payload, layered-history
 */
@Injectable()
@HookController({ pluginName: 'conversation', tags: ['conversation', 'history'] })
export class ConversationSmartHookController {
  constructor(
    @InjectRepository(ChatSessionSmartEntity)
    private readonly smartRepo: Repository<ChatSessionSmartEntity>,
    @InjectRepository(ChatMessageEntity)
    private readonly messageRepo: Repository<ChatMessageEntity>,
  ) {}

  /**
   * 拉 session 下所有 smart 段的 keywords (zh+en) 聚合, 去重 + 频次倒序。
   * @keyword-cn Smart标签全景
   * @keyword-en hook-smart-tags
   */
  @HookRoute({
    hook: 'saas.app.conversation.smartTags',
    description:
      '【三步检索 ①】拉指定会话所有 smart 段的 keywords 全景 (zh+en 合并, 去重, 频次倒序)。' +
      '是历史上下文检索的起点; 看完全景后用 smartSearch 缩范围, 最后用 smartMessages 取全消息。',
    args: [smartTagsSchema],
    metadata: { tags: ['conversation', 'smart', 'history', 'tag'] },
  })
  @CheckAbility('read', 'session')
  async handleSmartTags(
    payload: SmartTagsPayload,
    _principal?: unknown,
    _context?: unknown,
    event?: HookEvent,
  ): Promise<HookResult> {
    const { sessionId } = payload;
    event?.log?.info('conversation.smartTags:start', { sessionId });
    try {
      const start = Date.now();
      const smarts = await this.smartRepo.find({
        where: { sessionId, isDelete: false },
        select: ['id', 'keywords'],
      });
      const counter = new Map<string, number>();
      for (const s of smarts) {
        for (const kw of flattenKeywords(s.keywords)) {
          counter.set(kw, (counter.get(kw) ?? 0) + 1);
        }
      }
      const items = Array.from(counter.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);
      event?.log?.info('conversation.smartTags:done', {
        smartCount: smarts.length,
        tagCount: items.length,
        durationMs: Date.now() - start,
      });
      return {
        status: HookResultStatus.Success,
        data: {
          sessionId,
          totalSmarts: smarts.length,
          items,
        },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      event?.log?.error('conversation.smartTags:fail', { error: msg });
      return { status: HookResultStatus.Error, error: msg };
    }
  }

  /**
   * 按 keywords 命中 smart 段, 返回 summary + keywords + 时间区间, 不含全消息。
   * @keyword-cn Smart段搜索
   * @keyword-en hook-smart-search
   */
  @HookRoute({
    hook: 'saas.app.conversation.smartSearch',
    description:
      '【三步检索 ②】按 keywords (任一命中即可) 在指定会话中匹配 smart 段, 返回每段的 summary / keywords / 起止消息 ID / 消息数。' +
      'smart 段按可见正文累计到配置阈值生成 (默认 5000, env CHAT_SESSION_SMART_SEGMENT_CHARS); 不返回全消息, 让 LLM 先按 summary 决策再用 smartMessages 精准取段。默认/上限 50 条, 按时间倒序。',
    args: [smartSearchSchema],
    metadata: { tags: ['conversation', 'smart', 'history', 'search'] },
  })
  @CheckAbility('read', 'session')
  async handleSmartSearch(
    payload: SmartSearchPayload,
    _principal?: unknown,
    _context?: unknown,
    event?: HookEvent,
  ): Promise<HookResult> {
    const { sessionId, keywords, limit } = payload;
    const cap = Math.min(limit ?? 50, 50);
    event?.log?.info('conversation.smartSearch:start', {
      sessionId,
      keywordCount: keywords.length,
      limit: cap,
    });
    try {
      const start = Date.now();
      const smarts = await this.smartRepo.find({
        where: { sessionId, isDelete: false },
        order: { createdAt: 'DESC' },
      });
      const wantSet = new Set(keywords.map((k) => k.toLowerCase()));
      const matched = smarts
        .filter((s) => {
          const tags = flattenKeywords(s.keywords).map((k) => k.toLowerCase());
          return tags.some((t) => wantSet.has(t));
        })
        .slice(0, cap)
        .map((s) => ({
          smartId: s.id,
          summary: s.summary,
          keywords: flattenKeywords(s.keywords),
          startMessageId: s.startMessageId,
          endMessageId: s.endMessageId,
          messageCount: s.messageCount,
          createdAt: s.createdAt,
        }));
      event?.log?.info('conversation.smartSearch:done', {
        scanned: smarts.length,
        matched: matched.length,
        durationMs: Date.now() - start,
      });
      return {
        status: HookResultStatus.Success,
        data: {
          sessionId,
          items: matched,
        },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      event?.log?.error('conversation.smartSearch:fail', { error: msg });
      return { status: HookResultStatus.Error, error: msg };
    }
  }

  /**
   * 按 smartId 列表精准取每段对应的 startMessageId..endMessageId 范围全消息。
   * @keyword-cn Smart段展开消息
   * @keyword-en hook-smart-messages
   */
  @HookRoute({
    hook: 'saas.app.conversation.smartMessages',
    description:
      '【三步检索 ③】按 smartId 列表 (来自 smartSearch) 精准展开成对应 smart 段的全消息。' +
      'sessionId 用作越权防护, 只返回属于该会话的消息。一次最多 20 段 smart, 单段按配置阈值分段 (默认 5000, env CHAT_SESSION_SMART_SEGMENT_CHARS)。',
    args: [smartMessagesSchema],
    metadata: { tags: ['conversation', 'smart', 'history', 'messages'] },
  })
  @CheckAbility('read', 'session')
  async handleSmartMessages(
    payload: SmartMessagesPayload,
    _principal?: unknown,
    _context?: unknown,
    event?: HookEvent,
  ): Promise<HookResult> {
    const { sessionId, smartIds } = payload;
    event?.log?.info('conversation.smartMessages:start', {
      sessionId,
      smartIdCount: smartIds.length,
    });
    try {
      const startTs = Date.now();
      const smarts = await this.smartRepo.find({
        where: { id: In(smartIds), sessionId, isDelete: false },
      });
      const segments: Array<{
        smartId: string;
        summary: string | null;
        startMessageId: string;
        endMessageId: string;
        messages: Array<{
          id: string;
          senderId: string | null;
          messageType: string;
          content: string;
          replyToId: string | null;
          createdAt: Date;
        }>;
      }> = [];

      for (const s of smarts) {
        const startMsg = await this.messageRepo.findOne({
          where: { id: s.startMessageId },
          select: ['id', 'createdAt'],
        });
        const endMsg = await this.messageRepo.findOne({
          where: { id: s.endMessageId },
          select: ['id', 'createdAt'],
        });
        if (!startMsg || !endMsg) {
          segments.push({
            smartId: s.id,
            summary: s.summary,
            startMessageId: s.startMessageId,
            endMessageId: s.endMessageId,
            messages: [],
          });
          continue;
        }
        const msgs = await this.messageRepo.find({
          where: {
            sessionId,
            createdAt: Between(startMsg.createdAt, endMsg.createdAt),
            isDelete: false,
          },
          order: { createdAt: 'ASC' },
          select: [
            'id',
            'senderId',
            'messageType',
            'content',
            'replyToId',
            'createdAt',
          ],
        });
        segments.push({
          smartId: s.id,
          summary: s.summary,
          startMessageId: s.startMessageId,
          endMessageId: s.endMessageId,
          messages: msgs.map((m) => ({
            id: m.id,
            senderId: m.senderId,
            messageType: m.messageType,
            content: m.content,
            replyToId: m.replyToId,
            createdAt: m.createdAt,
          })),
        });
      }

      event?.log?.info('conversation.smartMessages:done', {
        requested: smartIds.length,
        returned: segments.length,
        totalMessages: segments.reduce((s, x) => s + x.messages.length, 0),
        durationMs: Date.now() - startTs,
      });
      return {
        status: HookResultStatus.Success,
        data: { sessionId, segments },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      event?.log?.error('conversation.smartMessages:fail', { error: msg });
      return { status: HookResultStatus.Error, error: msg };
    }
  }
}
