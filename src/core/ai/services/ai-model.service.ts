import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import {
  ChatOpenAI,
  ChatOpenAICompletionsCallOptions,
  ChatOpenAIResponsesCallOptions,
} from '@langchain/openai';
import { ChatAnthropic, ChatAnthropicCallOptions } from '@langchain/anthropic';
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIChatCallOptions,
} from '@langchain/google-genai';
// 移除具体调用参数类型，改为让编译器在调用处推断
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  BaseMessage,
  AIMessageChunk,
} from '@langchain/core/messages';
import type {
  AIModelType,
  AIModelConfig,
  AIModelRequest,
  AIModelResponse,
  ChatMessage,
  TokenUsage,
  ModelTokenUsageMeta,
  // ModelBindParams, // 移除未使用的类型
  ModelParameters,
  AICoreModuleOptions,
} from '../types';
import { AIProvider } from '../types';
import { AIModelStatus } from '../types';
import { AIModelEntity } from '../entities';
import { ContextService } from './context.service';
import {
  applyAIProxyFromEnv,
  applyAIProxyFetchOverride,
} from '../proxy.config';
// 避免 barrel 导致的类型不精确问题，直接从具体文件与类型定义导入
import { loadAIConfigFromEnv } from '../../../config/ai.config';
import type { AIConfig } from '../../../config/types';
import { createAgent } from 'langchain';
import { ModuleRef } from '@nestjs/core';

/**
 * AI模型服务
 * 负责管理AI模型实例、处理模型调用、集成LangChain
 */
@Injectable()
export class AIModelService implements OnModuleInit {
  private readonly logger = new Logger(AIModelService.name);
  // Ensure proxy is applied even if Nest lifecycle hooks are not triggered
  private static proxyConfigured = false;

  constructor(
    @InjectRepository(AIModelEntity)
    private readonly aiModelRepository: Repository<AIModelEntity>,
    @Inject(forwardRef(() => ContextService))
    private readonly contextService: ContextService,
    @Inject('AI_CORE_OPTIONS')
    private readonly aiCoreOptions: AICoreModuleOptions,
    private moduleRef: ModuleRef,
  ) {}

  onModuleInit(): void {
    // Apply proxy configuration via lifecycle hook
    this.ensureProxyConfigured();
  }

  /**
   * Fallback proxy configuration to cover scenarios where onModuleInit is not called
   * (e.g., direct service usage in tests without full Nest application bootstrap).
   */
  private ensureProxyConfigured(): void {
    if (!AIModelService.proxyConfigured) {
      applyAIProxyFromEnv(this.logger);
      applyAIProxyFetchOverride(this.logger);
      AIModelService.proxyConfigured = true;
    }
  }

  /**
   * 创建AI模型实例
   */
  private createModelInstance(config: AIModelEntity, request: AIModelRequest) {
    try {
      let model: ChatOpenAI | ChatAnthropic | ChatGoogleGenerativeAI;
      const aiConf: AIConfig = loadAIConfigFromEnv();
      const maxRetries = aiConf.client.maxRetries;
      // 代理已在 onModuleInit 通过 applyAIProxyFetchOverride 全局生效，无需在此重复设置
      switch (config.provider) {
        case AIProvider.OPENAI:
          model = new ChatOpenAI({
            openAIApiKey: config.apiKey,
            modelName: config.name,
            temperature: config.defaultParams?.temperature || 0.7,
            maxTokens: config.defaultParams?.maxTokens || 4096,
            ...(config.baseURL && {
              configuration: { baseURL: config.baseURL },
            }),
          });
          break;
        case AIProvider.DEEPSEEK:
          {
            const baseURL = config.baseURL || 'https://api.deepseek.com';
            model = new ChatOpenAI({
              apiKey: config.apiKey,
              modelName: config.name,
              temperature: config.defaultParams?.temperature || 0.7,
              maxTokens: config.defaultParams?.maxTokens || 4096,
              configuration: { baseURL },
            });
          }
          break;

        case AIProvider.ANTHROPIC:
          model = new ChatAnthropic({
            anthropicApiKey: config.apiKey,
            modelName: config.name,
            temperature: config.defaultParams?.temperature || 0.7,
            maxTokens: config.defaultParams?.maxTokens || 4096,
            maxRetries,
            ...(config.baseURL && {
              clientOptions: { baseURL: config.baseURL },
            }),
          });
          break;

        case AIProvider.GOOGLE:
          model = new ChatGoogleGenerativeAI({
            apiKey: config.apiKey,
            model: config.name,
            temperature: config.defaultParams?.temperature || 0.7,
            maxOutputTokens: config.defaultParams?.maxTokens || 4096,
          });
          break;

        case AIProvider.GEMINI:
          model = new ChatGoogleGenerativeAI({
            apiKey: config.apiKey,
            model: config.name,
            temperature: config.defaultParams?.temperature || 0.7,
            maxOutputTokens: config.defaultParams?.maxTokens || 4096,
          });
          break;

        default:
          throw new Error(
            `Unsupported AI provider: ${String(config.provider)}`,
          );
      }
      this.logger.log(
        `Created model instance: ${config.id} (${config.provider})`,
      );
      request.openFunction = request.openFunction ?? '*';
      const openFunction = this.getOpenFunction(request);
      const Agent = createAgent({
        model: model,
        tools: openFunction,
        checkpointer: request.checkpointer,
        systemPrompt: request.systemPrompt,
      });
      return Agent;
    } catch (error) {
      this.logger.error(`Failed to create model instance: ${config.id}`, error);
      throw error;
    }
  }

  /**
   * 发送聊天请求
   */
  async chat(request: AIModelRequest): Promise<AIModelResponse> {
    const startTime = Date.now();

    try {
      // Ensure proxy is applied in case lifecycle hook didn't run
      this.ensureProxyConfigured();
      const agent = await this.getModelInstance(request);
      const messages = this.convertToLangChainMessages(request.messages);

      const invocationOptions = await this.buildInvocationOptions(
        agent,
        request,
      );
      const response = await agent.invoke(
        {
          messages,
        },
        invocationOptions,
      );

      const responseTime = Date.now() - startTime;

      // 构建响应
      let contentStr: string = '';
      const respAny = response as Record<string, unknown>;
      const directContent = respAny['content'];
      if (typeof directContent === 'string') {
        contentStr = directContent;
      } else if ('messages' in respAny) {
        const msgs = respAny['messages'];
        if (Array.isArray(msgs)) {
          const aiMsg = this.handleMessage(msgs, 'assistant');
          contentStr = typeof aiMsg?.content === 'string' ? aiMsg.content : '';
        } else if (typeof msgs === 'string') {
          contentStr = msgs;
        } else {
          contentStr = '';
        }
      }
      const aiResponse: AIModelResponse = {
        content: contentStr,
        model: request.modelId,
        responseTime,
        requestId: this.generateRequestId(),
        tokensUsed: undefined,
      };

      const responseTo =
        'messages' in (response as Record<string, unknown>)
          ? this.handleMessage(
              (response as { messages: BaseMessage[] }).messages,
              'assistant',
            )
          : undefined;

      if (responseTo) {
        aiResponse.tokensUsed = this.handleCountTokenToEntity(responseTo);
      }

      this.logger.log(
        `Chat completed for model ${request.modelId} in ${responseTime}ms`,
      );
      return aiResponse;
    } catch (error) {
      this.logger.error(
        `Chat failed for model ${request.modelId} after ${Date.now() - startTime}ms`,
        error,
      );

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`AI model request failed: ${errorMessage}`);
    }
  }
  handleCountTokenToEntity(responseTo: AIMessage) {
    // 尝试获取token使用信息
    const meta = responseTo?.usage_metadata;
    if (this.hasTokenUsage(meta) && meta.tokenUsage) {
      return this.extractTokenUsage(meta.tokenUsage);
    }
    return undefined;
  }
  /**
   * 根据传入的 role 返回「最后一个」匹配的消息，并且保持精确类型。
   * - human => HumanMessage | undefined
   * - system => SystemMessage | undefined
   * - assistant(default) => AIMessage | undefined
   */
  // 重载签名：根据 role 精确化返回类型
  handleMessage(
    messages: BaseMessage[] | { model_request: { messages: BaseMessage[] } },
    role: 'human',
  ): HumanMessage | undefined;
  handleMessage(
    messages: BaseMessage[] | { model_request: { messages: BaseMessage[] } },
    role: 'system',
  ): SystemMessage | undefined;
  handleMessage(
    messages: BaseMessage[] | { model_request: { messages: BaseMessage[] } },
    role?: 'assistant',
  ): AIMessage | undefined;
  handleMessage(
    messages: BaseMessage[] | { model_request: { messages: BaseMessage[] } },
    role: 'human' | 'system' | 'assistant' = 'assistant',
  ) {
    const msgs =
      'model_request' in messages ? messages.model_request.messages : messages;

    // 倒序查找，返回最后一个符合 role 的消息
    for (let index = msgs.length - 1; index >= 0; index--) {
      const msg = msgs[index];
      if (role === 'human' && msg instanceof HumanMessage) {
        return msg;
      }
      if (role === 'system' && msg instanceof SystemMessage) {
        return msg;
      }
      if (role === 'assistant' && msg instanceof AIMessage) {
        return msg;
      }
    }
    return undefined;
  }

  /**
   * 使用会话上下文（滑动窗口）进行聊天调用。
   * - 当提供 windowSize 时，使用最近 windowSize 条非系统消息；否则使用默认 analysisWindowSize。
   * - includeSystem=true 时，会在返回的消息数组头部包含系统消息。
   */
  async chatWithContext(args: {
    modelId: string;
    sessionId: string;
    windowSize?: number;
    includeSystem?: boolean;
    params?: Partial<ModelParameters> & {
      stream?: boolean;
      stop?: string[];
    };
  }): Promise<AIModelResponse> {
    const {
      modelId,
      sessionId,
      windowSize,
      includeSystem = true,
      params,
    } = args;
    const messages =
      typeof windowSize === 'number' && windowSize > 0
        ? await this.contextService.getRecentMessages(
            sessionId,
            windowSize,
            includeSystem,
          )
        : await this.contextService.getAnalysisWindow(sessionId, includeSystem);

    return this.chat({ modelId, messages, params, sessionId });
  }

  /**
   * 使用关键词滑动窗口进行聊天调用（函数调用支持）。
   * - keywords 由模型通过 function-call 提供；系统据此筛选上下文消息。
   * - limit 存在时使用对应窗口大小；否则使用默认 analysisWindowSize。
   * - includeSystem=true 时，会在消息数组头部包含系统消息。
   */
  async chatWithKeywordContext(args: {
    modelId: string;
    sessionId: string;
    keywords: string[];
    limit?: number;
    includeSystem?: boolean;
    matchMode?: 'any' | 'all';
    params?: Partial<ModelParameters> & {
      stream?: boolean;
      stop?: string[];
    };
  }): Promise<AIModelResponse> {
    const {
      modelId,
      sessionId,
      keywords,
      limit,
      includeSystem = true,
      matchMode = 'any',
      params,
    } = args;

    const messages = await this.contextService.getKeywordContext(
      sessionId,
      keywords,
      includeSystem,
      limit,
      matchMode,
    );

    return this.chat({ modelId, messages, params, sessionId });
  }

  /**
   * 流式聊天请求
   */
  async *chatStream(
    request: AIModelRequest,
  ): AsyncGenerator<import('../types').ModelSseEvent, AIModelResponse> {
    const startTime = Date.now();

    try {
      // Ensure proxy is applied in case lifecycle hook didn't run
      this.ensureProxyConfigured();
      const agent = await this.getModelInstance(request);
      const messages = this.convertToLangChainMessages(request.messages);

      const recursionLimit = 16;
      const invocationOptions = await this.buildInvocationOptions(
        agent,
        request,
      );
      const stream = agent.streamEvents(
        {
          messages,
        },
        {
          recursionLimit,
          ...(invocationOptions ?? {}),
        },
      );
      const runIdToToolId = new Map<string, string>();
      let finalOutput: unknown = null;
      for await (const event of stream) {
        const data = event.data as {
          chunk?: AIMessageChunk;
          input?: any;
          output?: any;
        };
        const evtName = event.event;
        const runId = event.run_id;
        switch (evtName) {
          case 'on_chat_model_stream': {
            const chunk = data?.chunk;
            if (!chunk) break;
            const addKw = chunk.additional_kwargs;
            const reasoning = addKw?.['reasoning_content'];
            if (typeof reasoning === 'string' && reasoning.length > 0) {
              yield { type: 'reasoning', data: { text: reasoning } };
              break;
            }
            if (typeof chunk.content === 'string') {
              const tags = (event as unknown as { tags?: string[] }).tags;
              if (Array.isArray(tags) && tags.includes('subagent')) break;
              yield { type: 'token', data: { text: chunk.content } };
              break;
            }
            const tChunks = (
              chunk as unknown as {
                tool_call_chunks?: Array<{
                  id?: string;
                  name?: string;
                  args?: unknown;
                  index?: number;
                }>;
              }
            ).tool_call_chunks;
            if (Array.isArray(tChunks) && tChunks.length > 0) {
              for (const tc of tChunks) {
                if (tc.id) {
                  if (typeof runId === 'string') {
                    runIdToToolId.set(tc.id, runId);
                  }
                  yield {
                    type: 'tool_start',
                    data: {
                      name: tc.name ?? '',
                      input: data?.input,
                      id: runId,
                    },
                  };
                  break;
                }
                yield {
                  type: 'tool_chunk',
                  data: {
                    id: runId,
                    name: tc.name,
                    args: tc.args,
                    index: tc.index,
                  },
                };
              }
            }
            break;
          }
          case 'on_tool_end': {
            const outAny = data?.output;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const toolId = outAny?.tool_call_id;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const rid = toolId ? runIdToToolId.get(toolId) : undefined;
            yield {
              type: 'tool_end',
              data: {
                name: (event as unknown as { name?: string }).name,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                output: outAny?.content,
                id: rid,
              },
            };
            break;
          }
          case 'on_chain_end': {
            const name = (event as unknown as { name?: string }).name;
            if (name === 'AgentExecutor' || !name) {
              finalOutput = data?.output;
            }
            break;
          }
          default:
            break;
        }
      }

      const responseTime = Date.now() - startTime;

      // 返回最终响应
      const aiResponse: AIModelResponse = {
        content:
          typeof (finalOutput as { content?: unknown })?.content === 'string'
            ? ((finalOutput as { content?: unknown }).content as string)
            : JSON.stringify(finalOutput ?? ''),
        model: request.modelId,
        responseTime,
        requestId: this.generateRequestId(),
        tokensUsed: undefined,
      };

      if (finalOutput && typeof finalOutput === 'object') {
        const maybeMessages = (finalOutput as Record<string, unknown>)[
          'messages'
        ];
        if (Array.isArray(maybeMessages)) {
          const responseTo = this.handleMessage(
            maybeMessages as BaseMessage[],
            'assistant',
          );
          if (responseTo) {
            aiResponse.tokensUsed = this.handleCountTokenToEntity(responseTo);
          }
        } else {
          const usageMeta = (finalOutput as Record<string, unknown>)[
            'usage_metadata'
          ];
          if (this.hasTokenUsage(usageMeta) && usageMeta.tokenUsage) {
            aiResponse.tokensUsed = this.extractTokenUsage(
              usageMeta.tokenUsage,
            );
          }
        }
      }

      return aiResponse;
    } catch (error) {
      this.logger.error(
        `Stream chat failed for model ${request.modelId}`,
        error,
      );
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`AI model stream request failed: ${errorMessage}`);
    }
  }

  /**
   * 更新AI模型配置
   */
  async updateModel(
    id: string,
    updates: Partial<AIModelConfig>,
    userId?: string,
    channelId?: string,
  ): Promise<AIModelEntity> {
    try {
      const existing = await this.aiModelRepository.findOne({ where: { id } });
      if (!existing) {
        throw new Error(`AI model not found: ${id}`);
      }

      const updated = await this.aiModelRepository.save({
        ...existing,
        ...updates,
        updatedAt: new Date(),
        updateUser: userId ?? existing.updateUser,
        channelId: channelId ?? existing.channelId,
      });

      this.logger.log(`Updated AI model: ${id}`);
      return updated;
    } catch (error) {
      this.logger.error(`Failed to update AI model: ${id}`, error);
      throw error;
    }
  }

  /**
   * 删除AI模型
   */
  async deleteModel(id: string): Promise<void> {
    try {
      // 软删除：标记 is_delete 并设置 deleted_at
      await this.aiModelRepository.update(
        { id },
        { isDelete: true, enabled: false },
      );
      await this.aiModelRepository.softDelete({ id });

      this.logger.log(`Soft deleted AI model: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete AI model: ${id}`, error);
      throw error;
    }
  }

  /**
   * 获取所有AI模型
   */
  async getModels(
    provider?: AIProvider,
    type?: AIModelType,
  ): Promise<AIModelEntity[]> {
    const where: FindOptionsWhere<AIModelEntity> = { isDelete: false };
    if (provider) where.provider = provider;
    if (type) where.type = type;

    return await this.aiModelRepository.find({ where });
  }

  /**
   * 获取指定AI模型
   */
  async getModel(id: string): Promise<AIModelEntity | null> {
    return await this.aiModelRepository.findOne({
      where: { id, isDelete: false },
    });
  }

  /**
   * 获取启用的AI模型
   */
  async getEnabledModels(): Promise<AIModelEntity[]> {
    return await this.aiModelRepository.find({
      where: { enabled: true, status: AIModelStatus.ACTIVE, isDelete: false },
    });
  }

  /**
   * 获取模型实例
   */
  private async getModelInstance(request: AIModelRequest) {
    const config = await this.aiModelRepository.findOne({
      where: {
        id: request.modelId,
        enabled: true,
        status: AIModelStatus.ACTIVE,
        isDelete: false,
      },
    });

    if (!config) {
      throw new Error(`AI model not found or disabled: ${request.modelId}`);
    }

    return this.createModelInstance(config, request);
  }

  /**
   * 转换消息格式为LangChain格式
   */
  private convertToLangChainMessages(messages: ChatMessage[]) {
    return messages.map((msg) => {
      switch (msg.role) {
        case 'system':
          return new SystemMessage({ content: msg.content });
        case 'user':
          return new HumanMessage({ content: msg.content });
        case 'assistant':
          return new AIMessage({ content: msg.content });
        default:
          throw new Error('Unknown message role');
      }
    });
  }

  /**
   * 应用模型参数（构建调用参数，而非绑定模型）
   */
  private applyModelParams(
    _model: unknown,
    _params: Partial<ModelParameters> & { stop?: string[] },
  ): ChatOpenAICompletionsCallOptions &
    ChatOpenAIResponsesCallOptions &
    ChatAnthropicCallOptions &
    GoogleGenerativeAIChatCallOptions {
    const options: ChatOpenAICompletionsCallOptions &
      ChatOpenAIResponsesCallOptions &
      ChatAnthropicCallOptions &
      GoogleGenerativeAIChatCallOptions = {};

    if (typeof _params.temperature === 'number') {
      (options as { temperature?: number }).temperature = _params.temperature;
    }
    if (typeof _params.topP === 'number') {
      (options as { topP?: number }).topP = _params.topP;
    }
    if (typeof _params.maxTokens === 'number') {
      (options as { maxTokens?: number }).maxTokens = _params.maxTokens;
      (options as { maxOutputTokens?: number }).maxOutputTokens =
        _params.maxTokens;
    }
    if (Array.isArray(_params.stop) && _params.stop.length > 0) {
      (options as { stop?: string[] }).stop = _params.stop;
    }

    return options;
  }

  /**
   * 统一构建调用参数：仅整合模型调用参数。
   * - 根据提供的 request.params 应用模型调用参数（temperature/topP/maxTokens 等）。
   * - 不再在此处构建或传递工具/函数调用相关配置；如需启用原生工具绑定，请由上层自行决定并整合。
   */
  private async buildInvocationOptions(
    model: unknown,
    request: AIModelRequest,
  ): Promise<
    | (ChatOpenAICompletionsCallOptions &
        ChatOpenAIResponsesCallOptions &
        ChatAnthropicCallOptions &
        GoogleGenerativeAIChatCallOptions)
    | undefined
  > {
    const callOptions = request.params
      ? this.applyModelParams(
          model,
          request.params as Partial<ModelParameters> & { stop?: string[] },
        )
      : {};
    let threadId: string | undefined = request.conversationGroupId;
    if (!threadId && request.sessionId) {
      const gid = await this.contextService.getConversationGroupIdForSession(
        request.sessionId,
      );
      threadId = gid ?? request.sessionId;
    }
    const cfg = threadId ? { configurable: { thread_id: threadId } } : {};
    return { ...callOptions, ...cfg };
  }

  private getOpenFunction(request: AIModelRequest) {
    const moduleIncludeFunction = this.aiCoreOptions.includeFunctionServices;
    const openSource = request.openFunction;
    const openSourceFunction = moduleIncludeFunction?.filter(
      (item) => openSource?.includes(item.name) || openSource == '*',
    );
    if (!openSourceFunction) return [];

    return openSourceFunction.map((item) => {
      return this.moduleRef.get(item, { strict: false }).getHandle();
    });
  }

  /**
   * 提取token使用信息
   */
  private extractTokenUsage(
    meta: ModelTokenUsageMeta | undefined,
  ): TokenUsage | undefined {
    if (!meta) return undefined;
    return {
      prompt: meta.promptTokens ?? 0,
      completion: meta.completionTokens ?? 0,
      total:
        meta.totalTokens ??
        (meta.promptTokens ?? 0) + (meta.completionTokens ?? 0),
    };
  }

  /**
   * 标准化 response_metadata，避免使用 as 断言
   */
  private hasTokenUsage(
    meta: unknown,
  ): meta is { tokenUsage?: ModelTokenUsageMeta } {
    return (
      typeof meta === 'object' &&
      meta !== null &&
      'tokenUsage' in (meta as Record<string, unknown>)
    );
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
