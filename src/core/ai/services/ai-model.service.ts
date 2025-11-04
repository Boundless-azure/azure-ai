import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import {
  BaseChatModel,
  BaseChatModelCallOptions,
} from '@langchain/core/language_models/chat_models';
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from '@langchain/core/messages';
import {
  AIProvider,
  AIModelType,
  AIModelStatus,
  AIModelConfig,
  AIModelRequest,
  AIModelResponse,
  ChatMessage,
  TokenUsage,
  ModelTokenUsageMeta,
  // ModelBindParams, // 移除未使用的类型
  ModelParameters,
} from '../types';
import type { FunctionCallDescription } from '@core/function-call/descriptions';
import { AIModelEntity } from '../entities';
import { ContextService } from './context.service';
import {
  applyAIProxyFromEnv,
  applyAIProxyFetchOverride,
} from '../proxy.config';
// 避免 barrel 导致的类型不精确问题，直接从具体文件与类型定义导入
import { loadAIConfigFromEnv } from '../../../config/ai.config';
import type { AIConfig } from '../../../config/types';
// 删除重复导入，保留上方综合导入块
// 已删除: import { AIModelRequest, AIModelResponse, TokenUsage, ModelTokenUsageMeta, ModelBindParams } from '../types';

/**
 * AI模型服务
 * 负责管理AI模型实例、处理模型调用、集成LangChain
 */
@Injectable()
export class AIModelService implements OnModuleInit {
  private readonly logger = new Logger(AIModelService.name);
  private modelInstances = new Map<string, BaseChatModel>();
  // Ensure proxy is applied even if Nest lifecycle hooks are not triggered
  private static proxyConfigured = false;

  constructor(
    @InjectRepository(AIModelEntity)
    private readonly aiModelRepository: Repository<AIModelEntity>,
    @Inject(forwardRef(() => ContextService))
    private readonly contextService: ContextService,
  ) {}

  async onModuleInit() {
    // Apply proxy configuration via lifecycle hook
    this.ensureProxyConfigured();
    await this.initializeModels();
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
   * 初始化所有启用的AI模型
   */
  private async initializeModels(): Promise<void> {
    const models: AIModelEntity[] = await this.aiModelRepository.find({
      where: { enabled: true, status: AIModelStatus.ACTIVE, isDelete: false },
    });

    let created = 0;
    for (const model of models) {
      // 跳过不受支持的提供商（例如已移除的 azure-openai），避免错误日志污染
      const supportedProviders = new Set<AIProvider>([
        AIProvider.OPENAI,
        AIProvider.ANTHROPIC,
        AIProvider.GOOGLE,
        AIProvider.GEMINI,
        AIProvider.DEEPSEEK,
      ]);
      if (!supportedProviders.has(model.provider)) {
        this.logger.warn(
          `Skip unsupported provider: ${String(model.provider)} (model ${model.id})`,
        );
        continue;
      }
      try {
        this.createModelInstance(model);
        created++;
      } catch (error) {
        this.logger.error(
          `Failed to create model instance: ${model.id}`,
          error,
        );
      }
    }

    this.logger.log(`Initialized ${created} AI models`);
  }

  /**
   * 创建AI模型实例
   */
  private createModelInstance(config: AIModelEntity): BaseChatModel {
    try {
      let model: BaseChatModel;
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
            maxRetries,
            ...(config.baseURL && {
              configuration: { baseURL: config.baseURL },
            }),
          });
          break;
        case AIProvider.DEEPSEEK:
          {
            const baseURL = config.baseURL || 'https://api.deepseek.com';
            model = new ChatOpenAI({
              openAIApiKey: config.apiKey,
              modelName: config.name,
              temperature: config.defaultParams?.temperature || 0.7,
              maxTokens: config.defaultParams?.maxTokens || 4096,
              maxRetries,
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
            maxRetries,
          });
          break;

        case AIProvider.GEMINI:
          model = new ChatGoogleGenerativeAI({
            apiKey: config.apiKey,
            model: config.name,
            temperature: config.defaultParams?.temperature || 0.7,
            maxOutputTokens: config.defaultParams?.maxTokens || 4096,
            maxRetries,
          });
          break;

        default:
          throw new Error(
            `Unsupported AI provider: ${String(config.provider)}`,
          );
      }

      this.modelInstances.set(config.id, model);
      this.logger.log(
        `Created model instance: ${config.id} (${config.provider})`,
      );

      return model;
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
      const model = await this.getModelInstance(request.modelId);
      const messages = this.convertToLangChainMessages(request.messages);

      // 统一初始化调用参数（仅模型参数）
      const invocationOptions = this.buildInvocationOptions(model, request);

      const response = invocationOptions
        ? await model.invoke(messages, invocationOptions)
        : await model.invoke(messages);
      const responseTime = Date.now() - startTime;

      // 构建响应
      const contentStr =
        typeof response.content === 'string'
          ? response.content
          : Array.isArray(response.content)
            ? JSON.stringify(response.content)
            : String(response.content);
      const aiResponse: AIModelResponse = {
        content: contentStr,
        model: request.modelId,
        responseTime,
        requestId: this.generateRequestId(),
      };

      // 不在此处提取函数调用结构

      // 尝试获取token使用信息
      const meta = response.response_metadata;
      if (this.hasTokenUsage(meta) && meta.tokenUsage) {
        aiResponse.tokensUsed = this.extractTokenUsage(meta.tokenUsage);
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
  ): AsyncGenerator<string, AIModelResponse> {
    const startTime = Date.now();

    try {
      // Ensure proxy is applied in case lifecycle hook didn't run
      this.ensureProxyConfigured();
      const model = await this.getModelInstance(request.modelId);
      const messages = this.convertToLangChainMessages(request.messages);

      // 统一初始化调用参数（仅模型参数）
      const invocationOptions = this.buildInvocationOptions(model, request);

      const stream = invocationOptions
        ? await model.stream(messages, invocationOptions)
        : await model.stream(messages);
      let fullContent = '';

      for await (const chunk of stream) {
        const content =
          typeof chunk.content === 'string'
            ? chunk.content
            : Array.isArray(chunk.content)
              ? JSON.stringify(chunk.content)
              : String(chunk.content);
        fullContent += content;
        yield content;
      }

      const responseTime = Date.now() - startTime;

      // 返回最终响应
      const aiResponse: AIModelResponse = {
        content: fullContent,
        model: request.modelId,
        responseTime,
        requestId: this.generateRequestId(),
      };

      // 不在此处提取或解析函数调用结构

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
   * 创建新的AI模型配置
   */
  async createModel(
    config: Omit<AIModelConfig, 'id' | 'createdAt' | 'updatedAt'>,
    userId?: string,
    channelId?: string,
  ): Promise<AIModelEntity> {
    try {
      const entity = this.aiModelRepository.create({
        ...config,
        createdAt: new Date(),
        updatedAt: new Date(),
        // 审计字段：创建者与更新者（如果有 userId）
        createdUser: userId,
        updateUser: userId,
        channelId,
      });

      const saved = await this.aiModelRepository.save(entity);

      // 如果模型启用，创建实例
      if (saved.enabled && saved.status === AIModelStatus.ACTIVE) {
        this.createModelInstance(saved);
      }

      this.logger.log(`Created AI model: ${saved.id}`);
      return saved;
    } catch (error) {
      this.logger.error('Failed to create AI model', error);
      throw error;
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

      // 重新创建模型实例
      this.modelInstances.delete(id);
      if (updated.enabled && updated.status === AIModelStatus.ACTIVE) {
        this.createModelInstance(updated);
      }

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

      this.modelInstances.delete(id);
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
   * 测试AI模型连接
   */
  async testModel(id: string): Promise<boolean> {
    try {
      const model = await this.getModelInstance(id);
      const testMessage = [new HumanMessage('Hello, this is a test message.')];

      await model.invoke(testMessage);
      this.logger.log(`Model test successful: ${id}`);
      return true;
    } catch (error) {
      this.logger.error(`Model test failed: ${id}`, error);
      return false;
    }
  }

  /**
   * 获取模型实例
   */
  private async getModelInstance(modelId: string): Promise<BaseChatModel> {
    let model = this.modelInstances.get(modelId);

    if (!model) {
      const config = await this.aiModelRepository.findOne({
        where: {
          id: modelId,
          enabled: true,
          status: AIModelStatus.ACTIVE,
          isDelete: false,
        },
      });

      if (!config) {
        throw new Error(`AI model not found or disabled: ${modelId}`);
      }

      model = this.createModelInstance(config);
    }

    return model;
  }

  /**
   * 转换消息格式为LangChain格式
   */
  private convertToLangChainMessages(messages: ChatMessage[]) {
    return messages.map((msg) => {
      switch (msg.role) {
        case 'system':
          return new SystemMessage(msg.content);
        case 'user':
          return new HumanMessage(msg.content);
        case 'assistant':
          return new AIMessage(msg.content);
        default:
          throw new Error('Unknown message role');
      }
    });
  }

  /**
   * 应用模型参数（构建调用参数，而非绑定模型）
   */
  private applyModelParams(
    model: BaseChatModel,
    params: Partial<ModelParameters>,
  ): BaseChatModelCallOptions & {
    maxOutputTokens?: number;
    topP?: number;
    maxTokens?: number;
    temperature?: number;
  } {
    const options: BaseChatModelCallOptions & {
      maxOutputTokens?: number;
      topP?: number;
      maxTokens?: number;
      temperature?: number;
    } = {};

    if (params.temperature !== undefined) {
      options.temperature = params.temperature;
    }
    if (params.topP !== undefined) {
      options.topP = params.topP;
    }
    if (params.maxTokens !== undefined) {
      if (model instanceof ChatGoogleGenerativeAI) {
        options.maxOutputTokens = params.maxTokens;
      } else {
        options.maxTokens = params.maxTokens;
      }
    }

    return options;
  }

  /**
   * 统一构建调用参数：仅整合模型调用参数。
   * - 根据提供的 request.params 应用模型调用参数（temperature/topP/maxTokens 等）。
   * - 不再在此处构建或传递工具/函数调用相关配置；如需启用原生工具绑定，请由上层自行决定并整合。
   */
  private buildInvocationOptions(
    model: BaseChatModel,
    request: AIModelRequest,
  ): BaseChatModelCallOptions | undefined {
    const callOptions = request.params
      ? this.applyModelParams(model, request.params)
      : undefined;
    return callOptions;
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
  /**
   * 将通用的 FunctionCallDescription 转换为各提供商可用的“原生工具调用”配置。
   * - OpenAI: tools = [{ type: 'function', function: { name, description, parameters } }]
   * - Anthropic: tools = [{ name, description, input_schema }]
   * - Gemini/GoogleGenAI: 暂不在此返回 tools（LangChain 当前缺少统一的配置入口）。
   *
   * 统一扩展点：如需为其它提供商启用原生工具绑定（例如 Gemini 的 bindTools），
   * 请在此方法集中新增并维护对应的工具定义转换逻辑，保持返回结构一致，便于上层按需选择是否传入。
   */
  private buildProviderToolOptions(
    model: BaseChatModel,
    descs: FunctionCallDescription[],
  ):
    | {
        tools: Array<
          | {
              type: 'function';
              function: {
                name: string;
                description?: string;
                parameters?: unknown;
              };
            }
          | {
              name: string;
              description?: string;
              input_schema?: unknown;
            }
        >;
      }
    | undefined {
    try {
      if (model instanceof ChatOpenAI) {
        const tools = descs.map((d) => ({
          type: 'function' as const,
          function: {
            name: d.name,
            description: d.description,
            parameters: d.parameters,
          },
        }));
        return { tools };
      }
      if (model instanceof ChatAnthropic) {
        const tools = descs.map((d) => ({
          name: d.name,
          description: d.description,
          input_schema: d.parameters,
        }));
        return { tools };
      }
      // ChatGoogleGenerativeAI / Gemini 暂不在此直接注入工具（LangChain支持有限）
      return undefined;
    } catch (error) {
      this.logger.warn('Failed to build provider tool options', error);
      return undefined;
    }
  }
}
