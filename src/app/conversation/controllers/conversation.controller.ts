import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Logger,
  Param,
  Sse,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { from, map } from 'rxjs';
import { ConversationService } from '../services/conversation.service';
import { AIModelService } from '@core/ai';
import { TypeOrmCheckpointSaver } from '@core/langgraph/checkpoint/services/typeorm-checkpoint.saver';
import type {
  ChatRequest,
  CreateSessionRequest,
  GetHistoryRequest,
  CreateSessionResponse,
  GetHistoryResponse,
  ConversationSseEvent,
} from '@/app/conversation/types/conversation.types';

/**
 * 外部对话控制器
 * 提供 AI 对话接口：
 * 1) POST /conversation/chat - 标准对话接口（支持流式和非流式）
 * 2) POST /conversation/sessions - 创建会话
 * 3) GET  /conversation/sessions/:sessionId/history - 获取历史
 *
 * @controller ConversationController
 * @category Conversation
 * @keywords Conversation, Stream, SSE, FunctionCall, Orchestrator, Mysql, KeywordWindow
 * 关键词: 会话, 流式, SSE, 函数调用, 编排器, MySQL, 关键词窗口
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
  async chat(@Body() request: ChatRequest) {
    const svc: ConversationService = this.conversationService;
    return await svc.chat(request);
  }

  @Sse('chat/stream')
  sseChat(
    @Query() request: ChatRequest,
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
}
