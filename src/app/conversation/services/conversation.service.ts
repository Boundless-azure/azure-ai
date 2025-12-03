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
 * @keywords-en Conversation, Chat, Streaming, SSE, Session, History, Context, Prompt, Assistant, User
 * @keywords-zh 会话, 聊天, 流式, SSE, 会话管理, 历史记录, 上下文, 提示词, 助手, 用户
 * @remarks
 * - 不进行函数调用编排或关键词检索，仅负责输入/输出与上下文。
 * - 后续可由上层 Agent 基于该服务的 I/O 扩展（检索、工具调用、工作流等）。
 * @since 1.0
 */
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly aiModelService: AIModelService,
    private readonly contextService: ContextService,
  ) {}

  /**
   * 处理标准对话请求：写入用户消息，调用 AI 模型，写入助手消息，并返回响应。
   * @param request 对话请求体：
   * - message: 必填，用户输入文本
   * - sessionId: 可选，用于复用既有会话，未提供则自动创建
   * - modelId: 可选，指定模型；未提供时自动选择默认启用模型
   * - systemPrompt: 可选，为新会话写入系统提示
   * @returns ChatResponse：
   * - sessionId: 当前会话 ID
   * - message: 助手输出的完整文本
   * - model: 实际使用的模型标识
   * - tokensUsed: 底层模型报告的 token 用量（若提供）
   * @keywords-en Chat, Reply, Single-turn, Plain, Non-Function-Call
   * @keywords-zh 对话, 回复, 单轮, 纯文本, 非函数调用
   * @remarks
   * - tokensUsed 由 AIModelService 提供，当前服务不持久化该字段。
   * - 若未传入 modelId，将选择第一个启用的模型作为默认。
   * - 上下文包含系统消息与历史消息，来源于 ContextService。
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
   * @param request 对话请求体：
   * - message: 必填，用户输入文本
   * - sessionId: 可选，复用既有会话，未提供则自动创建
   * - modelId: 可选，指定模型；未提供时自动选择默认启用模型
   * - systemPrompt: 可选，为新会话写入系统提示
   * @returns AsyncGenerator<StreamChunk>：
   * - { type: 'content', content, sessionId } 增量内容分片
   * - { type: 'done', sessionId } 结束标记
   * - { type: 'error', error } 错误信息
   * @keywords-en Stream, SSE, Realtime, AsyncGenerator, Delta
   * @keywords-zh 流式, SSE, 实时, 异步生成器, 增量
   * @remarks
   * - 服务会在流结束后将完整内容写入上下文并以 'assistant' 角色保存。
   * - 底层 AI 请求带有 stream=true，适用于 Server-Sent Events 或前端流式渲染。
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
   * @keywords-en Model, Default, Selection, Fallback
   * @keywords-zh 模型, 默认, 选择, 回退
   * @throws 当没有启用的模型时抛出错误，提示先配置模型。
   * @remarks 通过 AIModelService.getEnabledModels() 获取启用模型列表。
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
   * @param request 创建会话请求体：
   * - systemPrompt: 可选，为会话写入初始系统提示（role='system'）
   * @returns CreateSessionResponse：
   * - sessionId: 新创建的会话 ID
   * - message: 创建结果提示
   * @keywords-en Session, Create, Bootstrap, SystemPrompt
   * @keywords-zh 会话, 创建, 初始化, 系统提示
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
   * @param request 获取历史请求体：
   * - sessionId: 必填，需要查询的会话 ID
   * @returns GetHistoryResponse：
   * - sessionId: 会话 ID
   * - messages: 格式化后的消息列表（role、content、timestamp、metadata）
   * @keywords-en Session, History, Transcript, Context
   * @keywords-zh 会话, 历史, 轨迹, 上下文
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
   * @param request 对话请求体：
   * - systemPrompt: 可选，为新会话写入系统提示
   * @returns 新的会话 ID
   * @keywords-en Session, Bootstrap, Internal, Helper
   * @keywords-zh 会话, 初始化, 内部, 辅助
   * @remarks 内部方法，用于 chat/chatStream 在未提供 sessionId 时初始化会话。
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
   * @returns ChatMessage[]：格式化后的消息数组（包含角色与内容；可能包含 timestamp/metadata）
   * @keywords-en Context, Messages, Retrieval
   * @keywords-zh 上下文, 消息, 检索
   * @remarks 调用 ContextService.getFormattedMessages(sessionId, includeSystem=true)。
   */
  private async getContextMessages(sessionId: string): Promise<ChatMessage[]> {
    return await this.contextService.getFormattedMessages(sessionId, true);
  }
}
