import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Observable } from 'rxjs';
import { from, map } from 'rxjs';
import { Repository, In, Between } from 'typeorm';
import { z } from 'zod';
import { ConversationService } from '../services/conversation.service';
import { AIModelService } from '@core/ai';
import { TypeOrmCheckpointSaver } from '@core/langgraph/checkpoint/services/typeorm-checkpoint.saver';
import type {
  CreateSessionRequest,
  GetHistoryRequest,
  CreateSessionResponse,
  GetHistoryResponse,
  ConversationSseEvent,
} from '@/app/conversation/types/conversation.types';
import { ChatRequestDto } from '@/app/conversation/types/conversation.types';
import type { RunnableConfig } from '@langchain/core/runnables';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import type { HookEvent, HookResult } from '@/core/hookbus/types/hook.types';
import { ChatSessionSmartEntity } from '@core/ai/entities/chat-session-smart.entity';
import { ChatMessageEntity } from '@core/ai/entities/chat-message.entity';

/**
 * @title Smart 历史检索 Hook payload schema (SSOT)
 * @description 三步检索流程的 zod schema, type 由 z.infer 派生供 controller hook 签名复用。
 * @keywords-cn Smart检索, payloadSchema, SSOT
 * @keywords-en smart-history, payload-schema, ssot
 */
const smartTagsSchema = z.object({
  sessionId: z.string().describe('目标 IM 会话 ID, 必填'),
});

const smartSearchSchema = z.object({
  sessionId: z.string().describe('目标 IM 会话 ID, 必填'),
  keywords: z
    .array(z.string().min(1))
    .min(1)
    .describe(
      '关键词列表, 任一命中即返回该 smart 段; 应当来自 smartTags 的返回',
    ),
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
 * 外部对话控制器
 * 提供 AI 对话接口：
 * 1) POST /conversation/chat - 标准对话接口（支持流式和非流式）
 * 2) POST /conversation/sessions - 创建会话
 * 3) GET  /conversation/sessions/:sessionId/history - 获取历史
 *
 * @controller ConversationController
 * @category Conversation
 * @keywords Conversation, Stream, SSE, FunctionCall, Orchestrator, Mysql, KeywordWindow, SmartHistory
 * 关键词: 会话, 流式, SSE, 函数调用, 编排器, MySQL, 关键词窗口, Smart检索
 */
@HookController({ pluginName: 'conversation', tags: ['conversation', 'history'] })
@Controller('conversation')
export class ConversationController {
  private readonly logger = new Logger(ConversationController.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly aiModelService: AIModelService,
    private readonly _checkpointer: TypeOrmCheckpointSaver,
    @InjectRepository(ChatSessionSmartEntity)
    private readonly smartRepo: Repository<ChatSessionSmartEntity>,
    @InjectRepository(ChatMessageEntity)
    private readonly messageRepo: Repository<ChatMessageEntity>,
  ) {}

  /**
   * AI 对话接口（支持流式与非流式返回）。
   * 当 Accept 包含 "text/stream" 或请求体中 stream=true 时，以 SSE 风格分片输出。
   *
   * @route POST /conversation/chat
   * @param request 对话请求体
   * @param acceptHeader 请求头 Accept
   * @param res Express 响应对象（直接写入）
   * @returns void（结果通过响应流输出或以 JSON 返回）
   * @keywords Conversation, Stream, SSE
   * 关键词: 对话, 流式, SSE
   */
  @Post('chat')
  @CheckAbility('read', 'thread')
  async chat(@Body() request: ChatRequestDto) {
    const svc: ConversationService = this.conversationService;
    return await svc.chat(request);
  }

  @Sse('chat/stream')
  @CheckAbility('read', 'thread')
  sseChat(
    @Query() request: ChatRequestDto,
  ): Observable<{ data: ConversationSseEvent }> {
    const svc: ConversationService = this.conversationService;
    return from(svc.chatStream(request)).pipe(map((ev) => ({ data: ev })));
  }

  /**
   * 创建新的对话会话。
   *
   * @route POST /conversation/sessions
   * @param request 创建会话请求体
   * @returns 会话创建结果
   * @keywords Conversation, Session
   * 关键词: 会话, 创建
   */
  @Post('sessions')
  @CheckAbility('read', 'thread')
  async createSession(
    @Body() request: CreateSessionRequest,
  ): Promise<CreateSessionResponse> {
    const svc: ConversationService = this.conversationService;
    // 该属性访问在某些 ESLint 类型服务环境下会被误判为 "error typed value"
    return await svc.createSession(request);
  }

  /**
   * 获取指定会话的历史记录。
   *
   * @route GET /conversation/sessions/:sessionId/history
   * @param sessionId 会话 ID
   * @param limit 返回的消息条数上限（可选）
   * @returns 历史记录结果
   * @keywords Conversation, History
   * 关键词: 会话, 历史
   */
  @Get('sessions/:sessionId/history')
  @CheckAbility('read', 'thread')
  async getSessionHistory(
    @Param('sessionId') sessionId: string,
    @Query('limit') limit?: string,
  ): Promise<GetHistoryResponse> {
    const request: GetHistoryRequest = {
      sessionId,
      limit: limit ? parseInt(limit) : undefined,
    };
    const svc: ConversationService = this.conversationService;
    // 该属性访问在某些 ESLint 类型服务环境下会被误判为 "error typed value"
    return await svc.getSessionHistory(request);
  }

  private pickString(obj: unknown, key: string): string {
    if (obj && typeof obj === 'object') {
      const v = (obj as Record<string, unknown>)[key];
      return typeof v === 'string' ? v : '';
    }
    return '';
  }

  /**
   * 列出指定线程的检查点（按时间倒序）。
   *
   * @route GET /conversation/checkpoints/:threadId
   * @param threadId 线程ID（通常等同于会话ID）
   * @param limit 返回数量上限（默认50）
   * @returns 检查点简要信息列表：checkpointId/ts/metadata
   */
  @Get('checkpoints/:threadId')
  @CheckAbility('read', 'thread')
  async listCheckpoints(
    @Param('threadId') threadId: string,
    @Query('limit') limit?: string,
  ): Promise<{
    threadId: string;
    items: Array<{
      checkpointId: string;
      ts: string;
      metadata?: Record<string, unknown>;
    }>;
  }> {
    const cfg: RunnableConfig = {
      configurable: { thread_id: threadId, checkpoint_ns: 'default' },
    };
    const lim = limit ? Math.max(1, parseInt(limit)) : 50;
    const items: Array<{
      checkpointId: string;
      ts: string;
      metadata?: Record<string, unknown>;
    }> = [];
    for await (const t of this._checkpointer.list(cfg, { limit: lim })) {
      const id = this.pickString(t.checkpoint, 'id');
      const ts = this.pickString(t.checkpoint, 'ts');
      items.push({
        checkpointId: id,
        ts,
        metadata: t.metadata as Record<string, unknown> | undefined,
      });
    }
    return { threadId, items };
  }

  /**
   * 获取指定检查点的详细内容与写入，附带从写入推导的对话片段。
   *
   * @route GET /conversation/checkpoints/:threadId/:checkpointId
   * @returns 检查点详情：checkpoint/metadata/writes/history
   */
  @Get('checkpoints/:threadId/:checkpointId')
  @CheckAbility('read', 'thread')
  async getCheckpointDetail(
    @Param('threadId') threadId: string,
    @Param('checkpointId') checkpointId: string,
  ): Promise<{
    threadId: string;
    checkpointId: string;
    checkpoint: { id: string; ts: string };
    metadata?: Record<string, unknown>;
    writes: Array<{ taskId: string; channel: string; value: unknown }>;
    history: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
      channel?: string;
    }>;
  }> {
    const cfg: RunnableConfig = {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: 'default',
        checkpoint_id: checkpointId,
      },
    };
    const tuple = await this._checkpointer.getTuple(cfg);
    if (!tuple) {
      return {
        threadId,
        checkpointId,
        checkpoint: { id: checkpointId, ts: '' },
        metadata: undefined,
        writes: [],
        history: [],
      };
    }

    const ckId = this.pickString(tuple.checkpoint, 'id') || checkpointId;
    const ckTs = this.pickString(tuple.checkpoint, 'ts');

    const writes: Array<{ taskId: string; channel: string; value: unknown }> =
      [];
    const history: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
      channel?: string;
    }> = [];

    for (const w of tuple.pendingWrites ?? []) {
      const taskId = String(w[0] ?? '');
      const channel = String(w[1] ?? '');
      const value = w[2];
      writes.push({ taskId, channel, value });

      const lower = channel.toLowerCase();
      if (
        lower === 'tool' ||
        lower === 'tools' ||
        lower.startsWith('tool_') ||
        lower.includes('function')
      ) {
        const obj =
          typeof value === 'object' && value
            ? (value as Record<string, unknown>)
            : undefined;
        const output = obj
          ? (obj['output'] as string | undefined) ||
            (obj['result'] as string | undefined)
          : undefined;
        if (
          lower.endsWith('tool_end') ||
          lower.includes('tool_end') ||
          lower.includes('tool_result')
        ) {
          if (typeof output === 'string' && output.trim().length > 0) {
            history.push({ role: 'assistant', content: output, channel });
          }
        }
        continue;
      }

      if (typeof value === 'object' && value) {
        const obj = value as Record<string, unknown>;
        const typeStr = (obj['type'] as string | undefined)?.toLowerCase();
        const roleRaw =
          (obj['role'] as string | undefined) ??
          (typeStr === 'human'
            ? 'user'
            : typeStr === 'ai'
              ? 'assistant'
              : typeStr === 'system'
                ? 'system'
                : undefined);
        const content =
          (obj['content'] as string | undefined) ||
          (obj['text'] as string | undefined) ||
          (obj['message'] as string | undefined);
        if (
          (roleRaw === 'system' ||
            roleRaw === 'user' ||
            roleRaw === 'assistant') &&
          typeof content === 'string'
        ) {
          history.push({ role: roleRaw, content, channel });
          continue;
        }
      }

      if (typeof value === 'string') {
        const lc = lower;
        const roleGuess: 'system' | 'user' | 'assistant' =
          lc.includes('user') || lc.includes('input')
            ? 'user'
            : lc.includes('system')
              ? 'system'
              : 'assistant';
        history.push({ role: roleGuess, content: value, channel });
      }
    }

    return {
      threadId,
      checkpointId: ckId,
      checkpoint: { id: ckId, ts: ckTs },
      metadata: tuple.metadata as Record<string, unknown> | undefined,
      writes,
      history,
    };
  }

  /**
   * 拉 session 下所有 smart 段的 keywords (zh+en) 聚合, 去重 + 频次倒序。
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
