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
import type { Observable } from 'rxjs';
import { from, map } from 'rxjs';
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

/**
 * @title Smart 历史检索 Hook payload schema (SSOT)
 * @description 三步检索流程的 zod schema, type 由 z.infer 派生供 controller hook 签名复用。
 * @keywords-cn Smart检索, payloadSchema, SSOT
 * @keywords-en smart-history, payload-schema, ssot
 */
export const smartTagsSchema = z.object({
  sessionId: z.string().describe('目标 IM 会话 ID, 必填'),
});

export const smartSearchSchema = z.object({
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

export const smartMessagesSchema = z.object({
  sessionId: z.string().describe('目标 IM 会话 ID, 必填'),
  smartIds: z
    .array(z.string())
    .min(1)
    .max(20)
    .describe(
      '要展开成全消息的 smart 段 ID 列表, 至少 1 个, 最多 20 个 (避免一次拉太多)',
    ),
});

/**
 * smart 段的 keywords 形状: { zh: string[], en: string[] } | null
 * @keyword-en smart-keywords-shape
 */
export function flattenKeywords(
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
@Controller('conversation')
export class ConversationController {
  private readonly logger = new Logger(ConversationController.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly aiModelService: AIModelService,
    private readonly _checkpointer: TypeOrmCheckpointSaver,
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
}
