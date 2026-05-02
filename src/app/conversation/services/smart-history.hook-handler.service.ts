import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import { z } from 'zod';
import { HookHandler } from '@/core/hookbus/decorators/hook-handler.decorator';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import type {
  HookEvent,
  HookResult,
} from '@/core/hookbus/types/hook.types';
import { ChatSessionSmartEntity } from '@core/ai/entities/chat-session-smart.entity';
import { ChatMessageEntity } from '@core/ai/entities/chat-message.entity';

/**
 * @title Smart 历史检索 Hook payload schema (SSOT)
 * @description 三步检索流程的 zod schema, type 由 z.infer 派生供 handler 签名复用。
 * @keywords-cn Smart检索, payloadSchema, SSOT, zod-infer
 * @keywords-en smart-history, payload-schema, ssot, zod-infer
 */
const smartTagsSchema = z.object({
  sessionId: z.string().describe('目标 IM 会话 ID, 必填'),
});

const smartSearchSchema = z.object({
  sessionId: z.string().describe('目标 IM 会话 ID, 必填'),
  keywords: z
    .array(z.string().min(1))
    .min(1)
    .describe('关键词列表, 任一命中即返回该 smart 段; 应当来自 smartTags 的返回'),
  limit: z
    .number()
    .int()
    .positive()
    .max(50)
    .optional()
    .describe('返回上限, 默认/上限 50 (按时间倒序)'),
});

const smartMessagesSchema = z.object({
  sessionId: z.string().describe('目标 IM 会话 ID, 必填'),
  smartIds: z
    .array(z.string())
    .min(1)
    .max(20)
    .describe(
      '要展开成全消息的 smart 段 ID 列表, 至少 1 个, 最多 20 个 (避免一次拉太多)',
    ),
});

type SmartTagsPayload = z.infer<typeof smartTagsSchema>;
type SmartSearchPayload = z.infer<typeof smartSearchSchema>;
type SmartMessagesPayload = z.infer<typeof smartMessagesSchema>;

/**
 * smart 段的 keywords 形状: { zh: string[], en: string[] } | null
 * @keyword-en smart-keywords-shape
 */
function flattenKeywords(
  keywords: { zh?: string[]; en?: string[] } | null | undefined,
): string[] {
  if (!keywords) return [];
  const zh = Array.isArray(keywords.zh) ? keywords.zh : [];
  const en = Array.isArray(keywords.en) ? keywords.en : [];
  return [...zh, ...en].filter(
    (s): s is string => typeof s === 'string' && s.trim().length > 0,
  );
}

/**
 * @title Smart 历史检索 Hook 处理器
 * @description 提供 3 个 hook 让 LLM 按"tag → 描述 → 全消息"三步精准检索会话历史:
 *              ① smartTags  :: 拉 session 下所有 smart 段的 keywords 全景, 按频次排序
 *              ② smartSearch :: 按 keywords 命中 smart 段, 返回每段的 summary (不含全消息)
 *              ③ smartMessages :: 按 smartId 精准展开成对应 startMessageId..endMessageId 范围全消息
 *
 *              这条链路解决"上下文不够时凭空猜历史"问题, 让 LLM 走分层检索:
 *              先看 tag 全景定位主题, 再看 summary 选段, 最后才拉全消息, 避免把整段历史塞进上下文。
 * @keywords-cn Smart检索, 三步流程, 分层检索, tag全景, summary选段, 全消息展开
 * @keywords-en smart-history, three-step-flow, layered-retrieval, tag-overview, summary-selection, full-messages
 */
@Injectable()
export class SmartHistoryHookHandlerService {
  private readonly logger = new Logger(SmartHistoryHookHandlerService.name);

  constructor(
    @InjectRepository(ChatSessionSmartEntity)
    private readonly smartRepo: Repository<ChatSessionSmartEntity>,
    @InjectRepository(ChatMessageEntity)
    private readonly messageRepo: Repository<ChatMessageEntity>,
  ) {}

  // ----------------------------------------------------------------
  // saas.app.conversation.smartTags — ① 取 session 的 keywords 全景
  // ----------------------------------------------------------------

  /**
   * 拉 session 下所有 smart 段的 keywords (zh+en) 聚合, 去重 + 频次倒序
   * 这是三步检索的起点, LLM 先看全景再决定按哪些 keyword 缩范围
   * @keyword-en hook-smart-tags
   */
  @HookHandler('saas.app.conversation.smartTags', {
    pluginName: 'conversation',
    tags: ['conversation', 'smart', 'history', 'tag'],
    description:
      '【三步检索 ①】拉指定会话所有 smart 段的 keywords 全景 (zh+en 合并, 去重, 频次倒序)。' +
      '是历史上下文检索的起点; 看完全景后用 smartSearch 缩范围, 最后用 smartMessages 取全消息。',
    payloadSchema: smartTagsSchema,
  })
  @CheckAbility('read', 'session')
  async handleSmartTags(
    event: HookEvent<SmartTagsPayload>,
  ): Promise<HookResult> {
    const { sessionId } = event.payload;
    event.log?.info('conversation.smartTags:start', { sessionId });
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
      event.log?.info('conversation.smartTags:done', {
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
      event.log?.error('conversation.smartTags:fail', { error: msg });
      return { status: HookResultStatus.Error, error: msg };
    }
  }

  // ----------------------------------------------------------------
  // saas.app.conversation.smartSearch — ② 按 keywords 缩范围, 返回 summary
  // ----------------------------------------------------------------

  /**
   * 按 keywords 命中 smart 段, 返回 summary + keywords + 时间区间, 不含全消息
   * @keyword-en hook-smart-search
   */
  @HookHandler('saas.app.conversation.smartSearch', {
    pluginName: 'conversation',
    tags: ['conversation', 'smart', 'history', 'search'],
    description:
      '【三步检索 ②】按 keywords (任一命中即可) 在指定会话中匹配 smart 段, 返回每段的 summary / keywords / 起止消息 ID / 消息数。' +
      '不返回全消息, 让 LLM 先按 summary 决策再用 smartMessages 精准取段。默认/上限 50 条, 按时间倒序。',
    payloadSchema: smartSearchSchema,
  })
  @CheckAbility('read', 'session')
  async handleSmartSearch(
    event: HookEvent<SmartSearchPayload>,
  ): Promise<HookResult> {
    const { sessionId, keywords, limit } = event.payload;
    const cap = Math.min(limit ?? 50, 50);
    event.log?.info('conversation.smartSearch:start', {
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
      event.log?.info('conversation.smartSearch:done', {
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
      event.log?.error('conversation.smartSearch:fail', { error: msg });
      return { status: HookResultStatus.Error, error: msg };
    }
  }

  // ----------------------------------------------------------------
  // saas.app.conversation.smartMessages — ③ 按 smartId 展开全消息
  // ----------------------------------------------------------------

  /**
   * 按 smartId 列表精准取每段对应的 startMessageId..endMessageId 范围全消息
   * @keyword-en hook-smart-messages
   */
  @HookHandler('saas.app.conversation.smartMessages', {
    pluginName: 'conversation',
    tags: ['conversation', 'smart', 'history', 'messages'],
    description:
      '【三步检索 ③】按 smartId 列表 (来自 smartSearch) 精准展开成对应 smart 段的全消息。' +
      'sessionId 用作越权防护, 只返回属于该会话的消息。一次最多 20 段 smart, 单段通常 5-10 条消息。',
    payloadSchema: smartMessagesSchema,
  })
  @CheckAbility('read', 'session')
  async handleSmartMessages(
    event: HookEvent<SmartMessagesPayload>,
  ): Promise<HookResult> {
    const { sessionId, smartIds } = event.payload;
    event.log?.info('conversation.smartMessages:start', {
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

      event.log?.info('conversation.smartMessages:done', {
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
      event.log?.error('conversation.smartMessages:fail', { error: msg });
      return { status: HookResultStatus.Error, error: msg };
    }
  }
}
