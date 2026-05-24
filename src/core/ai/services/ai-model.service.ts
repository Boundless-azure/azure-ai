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
import { AIModelApiSpec } from '../types/ai-model.types';
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
import { selectProcessor } from '../processors';
import type { ChunkContext } from '../processors';
import { KimiChatOpenAI } from '../providers/kimi-chat-openai';

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
   * @keyword-en model-instance-provider-routing
   */
  private createModelInstance(config: AIModelEntity, request: AIModelRequest) {
    try {
      let model: ChatOpenAI | ChatAnthropic | ChatGoogleGenerativeAI;
      const aiConf: AIConfig = loadAIConfigFromEnv();
      const maxRetries = aiConf.client.maxRetries;
      // 代理已在 onModuleInit 通过 applyAIProxyFetchOverride 全局生效，无需在此重复设置
      // thinking 模式 :: 独立 boolean 列 (thinking_enabled), enabled=true 时各 provider 用合理默认值
      //  - Anthropic Claude 4.x :: budget_tokens = 4096
      //  - OpenAI o-series :: reasoning_effort = 'medium'
      //  - Gemini 2.5 :: thinkingBudget = 4096
      //  - DeepSeek-R1 :: 模型自带, 不传
      // thinking 模式 :: 每个 provider 用自己规范的字段, 不要混用
      //  - Anthropic Claude 4.x       :: { thinking: { type: 'enabled', budget_tokens: 4096 } }
      //  - OpenAI o-series (o1/o3/o4) :: { reasoning_effort: 'medium' }
      //  - Azure OpenAI o-series      :: 同 OpenAI
      //  - Gemini 2.5                 :: { thinkingConfig: { thinkingBudget: 4096 } }
      //  - DeepSeek-R1 (reasoner)     :: 模型自带, 不传 (传 reasoning_effort 反而被忽略 / 不识别)
      //  - Kimi / Moonshot            :: OpenAI 兼容协议, 专用 adapter 保留 reasoning_content
      //  - MiniMax                    :: 国内/海外 OpenAI + Anthropic 兼容协议; 默认国内 Anthropic endpoint
      //  - NVIDIA NIM (Qwen3 / QwQ / DeepSeek-R1 等)
      //                               :: vLLM 标准开关 { chat_template_kwargs: { enable_thinking: bool } }
      //                                  注意 enable_thinking=false 才能强制关闭, 不传一般默认开
      //  - Custom OpenAI 兼容          :: 让用户在模型 modelKwargs 自填 (服务差异太大)
      const thinkingEnabled = config.thinkingEnabled === true;
      const anthropicThinkingKwargs = thinkingEnabled
        ? { thinking: { type: 'enabled' as const, budget_tokens: 4096 } }
        : undefined;
      const openaiReasoningKwargs = thinkingEnabled
        ? { reasoning_effort: 'medium' as const }
        : undefined;
      const geminiThinkingKwargs = thinkingEnabled
        ? { thinkingConfig: { thinkingBudget: 4096 } }
        : undefined;
      // NVIDIA NIM :: 显式开 / 关 thinking; 默认 NIM 部署常态开启, 不传则使用部署默认
      const nvidiaThinkingKwargs = {
        chat_template_kwargs: { enable_thinking: thinkingEnabled },
      };

      switch (config.provider) {
        case 'openai':
          model = new ChatOpenAI({
            openAIApiKey: config.apiKey,
            modelName: config.name,
            temperature: config.defaultParams?.temperature || 0.7,
            maxTokens: config.defaultParams?.maxTokens || 4096,
            __includeRawResponse: true,
            ...(openaiReasoningKwargs && {
              modelKwargs: openaiReasoningKwargs,
            }),
            ...(config.baseURL && {
              configuration: { baseURL: config.baseURL },
            }),
          } as ConstructorParameters<typeof ChatOpenAI>[0] & {
            __includeRawResponse?: boolean;
          });
          break;
        case 'deepseek':
          {
            const baseURL = config.baseURL || 'https://api.deepseek.com';
            // deepseek-reasoner / r1 自带 reasoning, 不需要传 thinking 参数
            model = new ChatOpenAI({
              apiKey: config.apiKey,
              modelName: config.name,
              temperature: config.defaultParams?.temperature || 0.7,
              maxTokens: config.defaultParams?.maxTokens || 4096,
              __includeRawResponse: true,
              configuration: { baseURL },
            } as ConstructorParameters<typeof ChatOpenAI>[0] & {
              __includeRawResponse?: boolean;
            });
          }
          break;
        case 'kimi':
          {
            // Kimi / Moonshot :: OpenAI 兼容协议, 国内默认 endpoint 为 api.moonshot.cn/v1.
            // KimiChatOpenAI 负责在 thinking + tool calling 时保留并回放 reasoning_content.
            const baseURL = config.baseURL || 'https://api.moonshot.cn/v1';
            model = new KimiChatOpenAI({
              apiKey: config.apiKey,
              modelName: config.name,
              maxTokens: config.defaultParams?.maxTokens || 4096,
              __includeRawResponse: true,
              modelKwargs: {
                thinking: { type: thinkingEnabled ? 'enabled' : 'disabled' },
              },
              configuration: { baseURL },
            } as ConstructorParameters<typeof ChatOpenAI>[0] & {
              __includeRawResponse?: boolean;
            });
          }
          break;
        case 'minimax':
          {
            // MiniMax :: 同时支持 OpenAI-compatible 与 Anthropic-compatible.
            // 国内默认 minimaxi.com, 海外可在 baseURL 中改为 api.minimax.io.
            if (config.apiProtocol === AIModelApiSpec.ANTHROPIC) {
              const baseURL =
                config.baseURL || 'https://api.minimaxi.com/anthropic';
              model = new ChatAnthropic({
                anthropicApiKey: config.apiKey,
                modelName: config.name,
                temperature: config.defaultParams?.temperature || 0.7,
                maxTokens: config.defaultParams?.maxTokens || 4096,
                maxRetries,
                ...(anthropicThinkingKwargs && {
                  modelKwargs: anthropicThinkingKwargs,
                }),
                clientOptions: { baseURL },
              });
            } else {
              const baseURL = config.baseURL || 'https://api.minimaxi.com/v1';
              model = new ChatOpenAI({
                apiKey: config.apiKey,
                modelName: config.name,
                temperature: config.defaultParams?.temperature || 0.7,
                maxTokens: config.defaultParams?.maxTokens || 4096,
                __includeRawResponse: true,
                modelKwargs: {
                  reasoning_split: true,
                },
                configuration: { baseURL },
              } as ConstructorParameters<typeof ChatOpenAI>[0] & {
                __includeRawResponse?: boolean;
              });
            }
          }
          break;
        case 'nvidia':
          {
            // NVIDIA NIM (build.nvidia.com / 自部署 vLLM) :: OpenAI 兼容协议,
            // 但 thinking 控制走 vLLM 标准 chat_template_kwargs.enable_thinking 而非 OpenAI o-series 的 reasoning_effort.
            // NIM 默认开启 thinking, 通过显式 enable_thinking=false 可强制关闭.
            const baseURL =
              config.baseURL || 'https://integrate.api.nvidia.com/v1';
            model = new ChatOpenAI({
              apiKey: config.apiKey,
              modelName: config.name,
              temperature: config.defaultParams?.temperature || 0.7,
              maxTokens: config.defaultParams?.maxTokens || 4096,
              __includeRawResponse: true,
              modelKwargs: nvidiaThinkingKwargs,
              configuration: { baseURL },
            } as ConstructorParameters<typeof ChatOpenAI>[0] & {
              __includeRawResponse?: boolean;
            });
          }
          break;
        case 'azure_openai':
          {
            model = new ChatOpenAI({
              apiKey: config.apiKey,
              modelName: config.name,
              temperature: config.defaultParams?.temperature || 0.7,
              maxTokens: config.defaultParams?.maxTokens || 4096,
              __includeRawResponse: true,
              ...(openaiReasoningKwargs && {
                modelKwargs: openaiReasoningKwargs,
              }),
              ...(config.baseURL && {
                configuration: { baseURL: config.baseURL },
              }),
            } as ConstructorParameters<typeof ChatOpenAI>[0] & {
              __includeRawResponse?: boolean;
            });
          }
          break;

        case 'anthropic':
          model = new ChatAnthropic({
            anthropicApiKey: config.apiKey,
            modelName: config.name,
            temperature: config.defaultParams?.temperature || 0.7,
            maxTokens: config.defaultParams?.maxTokens || 4096,
            maxRetries,
            ...(anthropicThinkingKwargs && {
              modelKwargs: anthropicThinkingKwargs,
            }),
            ...(config.baseURL && {
              clientOptions: { baseURL: config.baseURL },
            }),
          });
          break;

        case 'google':
          model = new ChatGoogleGenerativeAI({
            apiKey: config.apiKey,
            model: config.name,
            temperature: config.defaultParams?.temperature || 0.7,
            maxOutputTokens: config.defaultParams?.maxTokens || 4096,
            ...(geminiThinkingKwargs && { modelKwargs: geminiThinkingKwargs }),
          });
          break;

        case 'gemini':
          model = new ChatGoogleGenerativeAI({
            apiKey: config.apiKey,
            model: config.name,
            temperature: config.defaultParams?.temperature || 0.7,
            maxOutputTokens: config.defaultParams?.maxTokens || 4096,
            ...(geminiThinkingKwargs && { modelKwargs: geminiThinkingKwargs }),
          });
          break;

        case 'custom':
          {
            // 自定义 provider :: 按 apiProtocol 路由到 OpenAI / Anthropic SDK
            // 用户可接任何 OpenAI / Anthropic 兼容服务 :: xai (grok) / moonshot / qwen (dashscope) / zhipu / mistral / 自部署 等
            // thinking 同步按 protocol 透传 (openai → reasoning_effort; anthropic → thinking budget)
            if (config.apiProtocol === AIModelApiSpec.ANTHROPIC) {
              model = new ChatAnthropic({
                anthropicApiKey: config.apiKey,
                modelName: config.name,
                temperature: config.defaultParams?.temperature || 0.7,
                maxTokens: config.defaultParams?.maxTokens || 4096,
                maxRetries,
                ...(anthropicThinkingKwargs && {
                  modelKwargs: anthropicThinkingKwargs,
                }),
                ...(config.baseURL && {
                  clientOptions: { baseURL: config.baseURL },
                }),
              });
            } else {
              model = new ChatOpenAI({
                apiKey: config.apiKey,
                modelName: config.name,
                temperature: config.defaultParams?.temperature || 0.7,
                maxTokens: config.defaultParams?.maxTokens || 4096,
                __includeRawResponse: true,
                ...(openaiReasoningKwargs && {
                  modelKwargs: openaiReasoningKwargs,
                }),
                ...(config.baseURL && {
                  configuration: { baseURL: config.baseURL },
                }),
              } as ConstructorParameters<typeof ChatOpenAI>[0] & {
                __includeRawResponse?: boolean;
              });
            }
          }
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
      // 合并外部注入的 tools（来自 agent-runtime 层）和内部注册的函数服务
      const extraTools = Array.isArray(request.tools) ? request.tools : [];
      const Agent = createAgent({
        model: model,
        tools: [...openFunction, ...extraTools] as Parameters<
          typeof createAgent
        >[0]['tools'],
        checkpointer: request.checkpointer,
        systemPrompt: request.systemPrompt,
      });
      // processor :: 按 provider 选 chunk → ModelSseEvent 迭代器,
      // 主流程不感知字段差异, 新增 provider 只需加 processor 文件 + 注册
      const processor = selectProcessor(config);
      return { agent: Agent, processor, config };
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
      const { agent, config } = await this.getModelInstance(request);
      const messages = this.convertToLangChainMessages(request.messages);

      const invocationOptions = this.buildInvocationOptions(
        agent,
        request,
        config,
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
      const { agent, processor, config } = await this.getModelInstance(request);
      const messages = this.convertToLangChainMessages(request.messages);

      const recursionLimit = 200;
      const invocationOptions = this.buildInvocationOptions(
        agent,
        request,
        config,
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
          input?: unknown;
          output?: unknown;
        };
        const evtName = event.event;
        const runId = event.run_id;
        switch (evtName) {
          case 'on_chat_model_stream': {
            const chunk = data?.chunk;
            if (!chunk) break;
            const tags = (event as { tags?: string[] }).tags;
            const ctx: ChunkContext = {
              isSubagent: Array.isArray(tags) && tags.includes('subagent'),
            };

            // [1] provider 特定的 reasoning / text 转换走 processor (每个 provider 一个文件)
            for (const ev of processor.processStreamChunk(chunk, ctx)) {
              yield ev;
            }

            // [2] tool_call_chunks 留在主流程 :: LangGraph 跨 provider 统一驱动, 字段一致;
            //     processor 不持有 runIdToToolId 这种跨 chunk 状态
            const tChunks = (
              chunk as {
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
            const output = data?.output as
              | { tool_call_id?: string; content?: unknown }
              | undefined;
            const toolId = output?.tool_call_id;
            const rid = toolId ? runIdToToolId.get(toolId) : undefined;
            yield {
              type: 'tool_end',
              data: {
                name: (event as { name?: string }).name,
                output: output?.content,
                id: rid,
              },
            };
            break;
          }
          case 'on_chain_end': {
            const name = (event as { name?: string }).name;
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

  async resolveModelNameByIds(modelIds: string[]): Promise<string | null> {
    const normalized = modelIds
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    if (!normalized.length) return null;
    for (const modelId of normalized) {
      const config = await this.aiModelRepository.findOne({
        where: {
          name: modelId,
          enabled: true,
          status: AIModelStatus.ACTIVE,
          isDelete: false,
        },
      });
      if (config?.name) return config.name;
    }
    const fallback = await this.aiModelRepository.findOne({
      where: {
        name: normalized[0],
        enabled: true,
        status: AIModelStatus.ACTIVE,
        isDelete: false,
      },
    });
    return fallback?.name ?? null;
  }

  /**
   * 获取模型实例
   */
  private async getModelInstance(request: AIModelRequest) {
    const modelName = request.modelId?.trim();
    if (!modelName) {
      throw new Error('model name is required');
    }
    const config = await this.aiModelRepository.findOne({
      where: {
        name: modelName,
        enabled: true,
        status: AIModelStatus.ACTIVE,
        isDelete: false,
      },
    });

    if (!config) {
      throw new Error(`AI model not found or disabled: ${modelName}`);
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
    provider?: string,
  ): ChatOpenAICompletionsCallOptions &
    ChatOpenAIResponsesCallOptions &
    ChatAnthropicCallOptions &
    GoogleGenerativeAIChatCallOptions {
    const options: ChatOpenAICompletionsCallOptions &
      ChatOpenAIResponsesCallOptions &
      ChatAnthropicCallOptions &
      GoogleGenerativeAIChatCallOptions = {};

    const omitSamplingParams = provider === 'kimi';

    if (!omitSamplingParams && typeof _params.temperature === 'number') {
      (options as { temperature?: number }).temperature = _params.temperature;
    }
    if (!omitSamplingParams && typeof _params.topP === 'number') {
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
  private buildInvocationOptions(
    model: unknown,
    request: AIModelRequest,
    config: AIModelEntity,
  ):
    | (ChatOpenAICompletionsCallOptions &
        ChatOpenAIResponsesCallOptions &
        ChatAnthropicCallOptions &
        GoogleGenerativeAIChatCallOptions)
    | undefined {
    const callOptions = request.params
      ? this.applyModelParams(
          model,
          request.params as Partial<ModelParameters> & { stop?: string[] },
          config.provider,
        )
      : {};
    let threadId: string | undefined = request.conversationGroupId;
    if (!threadId && request.sessionId) {
      threadId = request.sessionId;
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
