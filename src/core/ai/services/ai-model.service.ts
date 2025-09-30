import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
import { AIModelEntity } from '../entities';
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

  constructor(
    @InjectRepository(AIModelEntity)
    private readonly aiModelRepository: Repository<AIModelEntity>,
  ) {}

  async onModuleInit() {
    await this.initializeModels();
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
              openAIApiKey: config.apiKey,
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
      const model = await this.getModelInstance(request.modelId);
      const messages = this.convertToLangChainMessages(request.messages);

      // 每次调用按需构建调用参数，避免使用已弃用的 bind
      const callOptions = request.params
        ? this.applyModelParams(model, request.params)
        : undefined;

      const response = callOptions
        ? await model.invoke(messages, callOptions)
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
   * 流式聊天请求
   */
  async *chatStream(
    request: AIModelRequest,
  ): AsyncGenerator<string, AIModelResponse> {
    const startTime = Date.now();

    try {
      const model = await this.getModelInstance(request.modelId);
      const messages = this.convertToLangChainMessages(request.messages);

      // 每次调用按需构建调用参数，避免使用已弃用的 bind
      const callOptions = request.params
        ? this.applyModelParams(model, request.params)
        : undefined;

      const stream = callOptions
        ? await model.stream(messages, callOptions)
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
      return {
        content: fullContent,
        model: request.modelId,
        responseTime,
        requestId: this.generateRequestId(),
      };
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
