import { Injectable, Logger } from '@nestjs/common';
import {
  AIModelService,
  ContextService,
  ChatMessage,
  AIModelRequest,
} from '@core/ai';
import type {
  ChatRequest,
  CreateSessionRequest,
  GetHistoryRequest,
  ChatResponse,
  StreamChunk,
  CreateSessionResponse,
  GetHistoryResponse,
} from '@/app/conversation/types/conversation.types';
@Injectable()
/**
 * 会话服务：封装 AI 对话与流式输出，仅负责上下文写入与内容返回。
 * @service ConversationService
 * @category Conversation
 * @keywords Conversation, Chat, Stream, SSE, Session, History
 * 关键词: 对话, 聊天, 流式, SSE, 会话, 历史
 * @remarks 本服务不进行函数调用编排或关键词检索；后续可由上层 Agent 基于该服务的输入/输出进行扩展。
 */
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly aiModelService: AIModelService,
    private readonly contextService: ContextService,
  ) {}

  /**
   * 处理标准对话请求：写入用户消息，调用 AI 模型，写入助手消息，并返回响应。
   * @param request 对话请求体（包含 sessionId 可复用会话，未提供则自动创建；可指定 modelId）
   * @returns 标准对话响应（包含内容、模型、tokensUsed，如果底层模型返回该数据）
   * @keywords Chat, Reply, Simple
   * 关键词: 对话, 回复, 简单
   * @remarks
   * - tokensUsed 由 AIModelService 提供，当前服务不持久化该字段。
   * - 若未传入 modelId，将选择第一个启用的模型作为默认。
   * @example
   * const res = await conversationService.chat({ message: '你好', sessionId });
   * console.log(res.message);
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const sessionId =
      request.sessionId || (await this.createNewSession(request));

    await this.contextService.addMessage(sessionId, {
      role: 'user',
      content: request.message,
    });

    const aiRequest: AIModelRequest = {
      modelId: request.modelId || (await this.pickDefaultModelId()),
      messages: [...(await this.getContextMessages(sessionId))],
      params: {
        temperature: 0.7,
        maxTokens: 2000,
      },
    };

    const response = await this.aiModelService.chat(aiRequest);

    await this.contextService.addMessage(sessionId, {
      role: 'assistant',
      content: response.content,
    });

    return {
      sessionId,
      message: response.content,
      model: response.model,
      tokensUsed: response.tokensUsed,
    };
  }

  /**
   * 处理流式对话请求：以 SSE 风格分片返回内容，结束时输出 type:'done'。
   * @param request 对话请求体（可选 sessionId 与 modelId）
   * @returns AsyncGenerator<StreamChunk>，content 表示内容分片，done 表示结束，error 表示错误
   * @keywords Stream, SSE, Realtime
   * 关键词: 流式, SSE, 实时
   * @example
   * for await (const chunk of conversationService.chatStream({ message: '你好' })) {
   *   if (chunk.type === 'content') { // 处理分片 }
   *   if (chunk.type === 'done') { // 完成 }
   * }
   */
  async *chatStream(request: ChatRequest): AsyncGenerator<StreamChunk> {
    try {
      const sessionId =
        request.sessionId || (await this.createNewSession(request));

      await this.contextService.addMessage(sessionId, {
        role: 'user',
        content: request.message,
      });

      const aiRequest: AIModelRequest = {
        modelId: request.modelId || (await this.pickDefaultModelId()),
        messages: [...(await this.getContextMessages(sessionId))],
        params: {
          temperature: 0.7,
          maxTokens: 2000,
          stream: true,
        },
      };

      let fullContent = '';

      const streamGenerator = this.aiModelService.chatStream(aiRequest);

      for await (const chunk of streamGenerator) {
        fullContent += chunk;
        yield {
          type: 'content',
          content: chunk,
          sessionId,
        };
      }

      await this.contextService.addMessage(sessionId, {
        role: 'assistant',
        content: fullContent,
      });

      yield {
        type: 'done',
        sessionId,
      };
    } catch (error) {
      this.logger.error('Stream chat error:', error);
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 选择默认模型：在未显式传入 modelId 时，返回第一个启用的模型。
   * @returns 默认模型的 ID
   * @keywords Model, Default
   * 关键词: 模型, 默认
   * @throws 当没有启用的模型时抛出错误，提示先配置模型。
   */
  private async pickDefaultModelId(): Promise<string> {
    const enabled = await this.aiModelService.getEnabledModels();
    if (!enabled.length) {
      throw new Error(
        'No enabled AI models. Please configure at least one model in ai_models table.',
      );
    }
    return enabled[0].id;
  }

  /**
   * 创建新会话，并可写入系统提示。
   * @param request 创建会话请求体（可选 systemPrompt）
   * @returns 会话创建结果，包含 sessionId
   * @keywords Session, Create
   * 关键词: 会话, 创建
   */
  async createSession(
    request: CreateSessionRequest,
  ): Promise<CreateSessionResponse> {
    const context = await this.contextService.createContext(
      undefined,
      request.systemPrompt,
      'system',
    );

    return {
      sessionId: context.sessionId,
      message: 'Session created successfully',
    };
  }

  /**
   * 获取会话历史消息（包含系统消息）。
   * @param request 获取历史请求体（sessionId 必填）
   * @returns 历史记录结果，包含消息列表（role、content、timestamp、metadata）
   * @keywords Session, History
   * 关键词: 会话, 历史
   */
  async getSessionHistory(
    request: GetHistoryRequest,
  ): Promise<GetHistoryResponse> {
    const messages = await this.contextService.getFormattedMessages(
      request.sessionId,
      true,
    );

    return {
      sessionId: request.sessionId,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp || new Date(),
        metadata: msg.metadata,
      })),
    };
  }

  /**
   * 创建新会话的辅助方法：根据请求写入系统提示（如果提供）。
   * @param request 对话请求体（可选 systemPrompt）
   * @returns 新的会话 ID
   * @keywords Session, Bootstrap
   * 关键词: 会话, 初始化
   */
  private async createNewSession(request: ChatRequest): Promise<string> {
    const context = await this.contextService.createContext(
      undefined,
      request.systemPrompt,
      'system',
    );
    return context.sessionId;
  }

  /**
   * 获取会话上下文消息列表（包含系统消息）。
   * @param sessionId 会话 ID
   * @returns 消息数组（包含角色与内容）
   * @keywords Context, Messages
   * 关键词: 上下文, 消息
   */
  private async getContextMessages(sessionId: string): Promise<ChatMessage[]> {
    return await this.contextService.getFormattedMessages(sessionId, true);
  }
}
