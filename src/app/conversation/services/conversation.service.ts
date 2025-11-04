import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  AIModelService,
  ContextService,
  ChatMessage,
  AIModelRequest,
  AIModelResponse,
} from '@core/ai';
import {
  PluginOrchestratorService,
  ContextFunctionService,
  MysqlReadonlyService,
} from '@core/function-call';
import {
  PluginOrchestrateFunctionDescription,
  ContextKeywordWindowFunctionDescription,
  FunctionCallDescription,
} from '@core/function-call/descriptions';
import type { FunctionCallHandle } from '@core/function-call/types';
import type { AICoreModuleOptions } from '@core/ai';
import type {
  ChatRequest,
  CreateSessionRequest,
  GetHistoryRequest,
  ChatResponse,
  StreamChunk,
  CreateSessionResponse,
  GetHistoryResponse,
  AIModelResponseWithFunctionCalls,
} from '@/app/conversation/types/conversation.types';
// 移除在 Service 层的运行时守卫使用，改为使用各函数服务的 getHandle().validate

// --------- 函数描述由 core/function-call 提供；注册类型统一在 types 目录维护 ---------

// 类型统一在 '@/app/conversation/types/conversation.types' 中维护，此处不重复声明。

@Injectable()
/**
 * 对话服务，封装 AI 对话、流式响应与函数调用编排。
 * @service ConversationService
 * @category Conversation
 * @keywords Conversation, Stream, SSE, FunctionCall, Orchestrator, Mysql, KeywordWindow
 * 关键词: 对话服务, 流式, 函数调用, 编排器, MySQL, 关键词窗口
 */
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly aiModelService: AIModelService,
    private readonly contextService: ContextService,
    private readonly pluginOrchestratorService: PluginOrchestratorService,
    private readonly contextFunctionService: ContextFunctionService,
    private readonly mysqlReadonlyService: MysqlReadonlyService,
    @Inject('AI_CORE_OPTIONS')
    private readonly aiCoreOptions?: AICoreModuleOptions,
  ) {}

  /**
   * 根据模块选项判断某个服务是否启用；若未配置则默认启用全部。
   * 优先级：includeFunctionServices（服务类） > includeFunction（按描述名称）
   */
  private isServiceIncluded(instance: unknown, _handleName: string): boolean {
    const serviceCtors = this.aiCoreOptions?.includeFunctionServices || [];
    if (serviceCtors.length > 0) {
      return serviceCtors.some(
        (ctor) =>
          instance instanceof
          (ctor as unknown as new (...args: unknown[]) => unknown),
      );
    }
    // 未配置时默认启用全部服务
    return true;
  }

  /**
   * 获取当前启用的函数句柄集合（由各服务提供）。
   */
  private getActiveHandles(): FunctionCallHandle[] {
    const handles: FunctionCallHandle[] = [];
    const plugin = this.pluginOrchestratorService.getHandle();
    if (this.isServiceIncluded(this.pluginOrchestratorService, plugin.name)) {
      handles.push(plugin);
    }
    const mysql = this.mysqlReadonlyService.getHandle();
    if (this.isServiceIncluded(this.mysqlReadonlyService, mysql.name)) {
      handles.push(mysql);
    }
    const ctx = this.contextFunctionService.getHandle();
    if (this.isServiceIncluded(this.contextFunctionService, ctx.name)) {
      handles.push(ctx);
    }
    return handles;
  }

  /**
   * 供外部调用，获取当前可用函数的配置项（不包含执行器）。
   * 同时兼容别名：context_keyword_window。
   */
  private getAvailableFunctionDescriptions(): FunctionCallDescription[] {
    const descriptions = this.getActiveHandles().map((h) => h.description);
    const ctx = this.contextFunctionService.getHandle();
    if (this.isServiceIncluded(this.contextFunctionService, ctx.name)) {
      descriptions.push(ContextKeywordWindowFunctionDescription);
    }
    return descriptions;
  }

  /**
   * 通过函数名称解析到对应的句柄（兼容别名）。
   */
  private resolveHandleByName(name: string): FunctionCallHandle | undefined {
    const handles = this.getActiveHandles();
    const direct = handles.find((h) => h.name === name);
    if (direct) return direct;
    // 兼容别名：context_keyword_window 使用 ContextFunctionService 的句柄
    const ctx = this.contextFunctionService.getHandle();
    if (
      name === ContextKeywordWindowFunctionDescription.name &&
      this.isServiceIncluded(this.contextFunctionService, ctx.name)
    ) {
      return ctx;
    }
    return undefined;
  }

  /**
   * 处理标准对话请求。
   * 将用户消息写入上下文，调用 AI 模型并在必要时执行函数调用编排。
   * @param request 对话请求体
   * @returns 标准对话响应
   * @keywords Conversation, FunctionCall
   * 关键词: 对话, 函数调用
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const sessionId =
      request.sessionId || (await this.createNewSession(request));

    // 添加用户消息到上下文
    await this.contextService.addMessage(sessionId, {
      role: 'user',
      content: request.message,
    });

    // 构建 AI 请求（未提供 modelId 时选择第一个启用的模型作为默认）
    const aiRequest: AIModelRequest = {
      modelId: request.modelId || (await this.pickDefaultModelId()),
      messages: [...(await this.getContextMessages(sessionId))],
      toolDescriptions: this.getAvailableFunctionDescriptions(),
      params: {
        temperature: 0.7,
        maxTokens: 2000,
      },
    };

    // 调用 AI 模型
    let response = await this.aiModelService.chat(aiRequest);

    // 处理 function calls（如果有）
    if (this.hasToolCalls(response)) {
      response = await this.handleFunctionCalls(response, sessionId, aiRequest);
    }

    // 添加助手回复到上下文
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
   * 处理流式对话请求。
   * 以 SSE 风格分片返回内容："data: {json}\n\n"，结束时输出 type:'done'。
   * @param request 对话请求体
   * @returns 流式分片生成器
   * @keywords Conversation, Stream, SSE
   * 关键词: 流式, SSE
   */
  async *chatStream(request: ChatRequest): AsyncGenerator<StreamChunk> {
    try {
      const sessionId =
        request.sessionId || (await this.createNewSession(request));

      // 添加用户消息到上下文
      await this.contextService.addMessage(sessionId, {
        role: 'user',
        content: request.message,
      });

      // 构建 AI 请求（未提供 modelId 时选择第一个启用的模型作为默认）
      const aiRequest: AIModelRequest = {
        modelId: request.modelId || (await this.pickDefaultModelId()),
        messages: [...(await this.getContextMessages(sessionId))],
        toolDescriptions: this.getAvailableFunctionDescriptions(),
        params: {
          temperature: 0.7,
          maxTokens: 2000,
          stream: true,
        },
      };

      let fullContent = '';

      // 流式调用 AI 模型
      const streamGenerator = this.aiModelService.chatStream(aiRequest);
      let finalResponse: AIModelResponse | undefined;

      for await (const chunk of streamGenerator) {
        // chunk 是字符串内容
        fullContent += chunk;
        yield {
          type: 'content',
          content: chunk,
          sessionId,
        };
      }

      // 获取最终响应（generator 的返回值）
      try {
        const result = await streamGenerator.next();
        if (result.done && result.value) {
          finalResponse = result.value;
        }
      } catch {
        // 如果无法获取返回值，创建一个基本的响应对象
        finalResponse = {
          content: fullContent,
          model: aiRequest.modelId,
          responseTime: 0,
        };
      }

      // 处理 function calls（如果有）
      if (finalResponse && this.hasToolCalls(finalResponse)) {
        const processedResponse = await this.handleFunctionCalls(
          finalResponse,
          sessionId,
          aiRequest,
        );

        // 如果有额外内容，发送它
        if (processedResponse.content !== fullContent) {
          const additionalContent = processedResponse.content.substring(
            fullContent.length,
          );
          if (additionalContent) {
            yield {
              type: 'content',
              content: additionalContent,
              sessionId,
            };
          }
        }

        fullContent = processedResponse.content;
      }

      // 添加完整回复到上下文
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
   * 当未显式传入 modelId 时，选取默认模型：已启用模型中的第一个。
   * 若无启用模型，抛出明确错误，提示用户先在数据库或配置中添加模型。
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
   * 创建新会话
   */
  async createSession(
    request: CreateSessionRequest,
  ): Promise<CreateSessionResponse> {
    /**
     * 创建新的对话会话。
     * @param request 创建会话请求体
     * @returns 会话创建结果
     * @keywords Conversation, Session
     * 关键词: 会话, 创建
     */
    const context = await this.contextService.createContext(
      undefined, // sessionId - 让服务自动生成
      request.systemPrompt,
      'system', // userId
    );

    return {
      sessionId: context.sessionId,
      message: 'Session created successfully',
    };
  }

  /**
   * 获取会话历史
   */
  async getSessionHistory(
    request: GetHistoryRequest,
  ): Promise<GetHistoryResponse> {
    /**
     * 获取会话历史消息。
     * @param request 获取历史请求体
     * @returns 历史记录结果
     * @keywords Conversation, History
     * 关键词: 会话, 历史
     */
    const messages = await this.contextService.getFormattedMessages(
      request.sessionId,
      true, // includeSystem
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
   * 创建新会话的辅助方法
   */
  private async createNewSession(request: ChatRequest): Promise<string> {
    /**
     * 根据请求创建新的会话，并写入系统提示（如果提供）。
     * @param request 对话请求体
     * @returns 新的会话 ID
     * @keywords Conversation, Session
     * 关键词: 会话, 系统提示
     */
    const context = await this.contextService.createContext(
      undefined, // sessionId - 让服务自动生成
      request.systemPrompt,
      'system', // userId
    );
    return context.sessionId;
  }

  /**
   * 获取上下文消息
   */
  private async getContextMessages(sessionId: string): Promise<ChatMessage[]> {
    /**
     * 获取会话上下文消息列表。
     * @param sessionId 会话 ID
     * @returns 消息数组（包含角色与内容）
     * @keywords Conversation, Context
     * 关键词: 上下文, 消息
     */
    return await this.contextService.getFormattedMessages(sessionId, true);
  }

  /**
   * 检查响应是否包含工具调用
   */
  private hasToolCalls(
    response: AIModelResponse,
  ): response is AIModelResponseWithFunctionCalls {
    /**
     * 判断 AI 响应是否包含工具调用。
     * @param response AI 响应
     * @returns 类型谓词，指示响应为带工具调用的结构
     * @keywords FunctionCall, Orchestrator
     * 关键词: 函数调用, 编排器
     */
    // 根据实际的 AIModelResponse 结构调整
    const responseWithFunctionCalls =
      response as AIModelResponseWithFunctionCalls;
    return !!(
      responseWithFunctionCalls.functionCalls &&
      responseWithFunctionCalls.functionCalls.length > 0
    );
  }

  /**
   * 处理 function calls
   */
  private async handleFunctionCalls(
    response: AIModelResponseWithFunctionCalls,
    contextId: string,
    originalRequest: AIModelRequest,
  ): Promise<AIModelResponse> {
    /**
     * 处理 AI 模型返回的函数调用，执行插件编排器与上下文函数。
     * @param response 带工具调用的 AI 响应
     * @param contextId 当前会话上下文 ID
     * @param originalRequest 原始 AI 请求（用于后续补全）
     * @returns 新的 AI 响应（包含最终内容）
     * @keywords FunctionCall, Orchestrator, Mysql, KeywordWindow
     * 关键词: 函数调用, 编排器, MySQL, 关键词窗口
     */
    const results = [];

    for (const functionCall of response.functionCalls || []) {
      let result: unknown;
      try {
        const handle = this.resolveHandleByName(functionCall.name);
        if (!handle) {
          throw new Error(`Unknown function: ${functionCall.name}`);
        }
        if (!handle.validate(functionCall.arguments)) {
          throw new Error(`Invalid arguments for ${functionCall.name}`);
        }
        // 特殊处理：plugin_orchestrate 需要系统补齐参数
        let argsToPass: unknown = functionCall.arguments;
        if (functionCall.name === PluginOrchestrateFunctionDescription.name) {
          const raw = functionCall.arguments as Record<string, unknown>;
          const input =
            raw &&
            typeof raw === 'object' &&
            raw['input'] &&
            typeof raw['input'] === 'object'
              ? (raw['input'] as Record<string, unknown>)
              : raw;
          argsToPass = {
            phase: 'plan',
            modelId: originalRequest.modelId,
            temperature:
              typeof originalRequest.params?.temperature === 'number'
                ? originalRequest.params?.temperature
                : 0.2,
            input,
          };
        }
        result = await handle.execute(argsToPass, {
          sessionId: contextId,
        });
        results.push({ name: functionCall.name, result });
      } catch (error) {
        this.logger.error(
          `Function call error for ${functionCall.name}:`,
          error,
        );
        results.push({
          name: functionCall.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 如果有 function call 结果，可能需要再次调用 AI 来处理结果
    if (results.length > 0) {
      // 添加 function 结果作为系统消息
      await this.contextService.addMessage(contextId, {
        role: 'system',
        content: `Function call results: ${JSON.stringify(results)}`,
        metadata: {
          type: 'function_results',
          functionCalls: results,
        },
      });

      const followUpRequest: AIModelRequest = {
        ...originalRequest,
        messages: await this.getContextMessages(contextId),
      };

      return await this.aiModelService.chat(followUpRequest);
    }

    return response;
  }
}
