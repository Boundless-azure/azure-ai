import {
  ChatOpenAI,
  ChatOpenAICompletions,
  type ChatOpenAIFields,
} from '@langchain/openai';
import { AIMessage, AIMessageChunk, BaseMessage } from '@langchain/core/messages';
import { ChatGenerationChunk } from '@langchain/core/outputs';
import type { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import type { BaseLanguageModelInput } from '@langchain/core/language_models/base';
import type { Runnable } from '@langchain/core/runnables';
import { convertMessagesToCompletionsMessageParams } from '@langchain/openai';

type OpenAIMessageParam = Record<string, unknown>;
type KimiChatRequest = {
  messages?: OpenAIMessageParam[];
  thinking?: { type?: string };
  stream?: boolean;
};

/**
 * @title Kimi ChatOpenAI 兼容模型
 * @description 针对 Kimi thinking + tool calling 保留并回放 reasoning_content。
 * @keywords-cn Kimi模型, 思考内容, 工具调用
 * @keywords-en kimi-chat-openai, reasoning-content, tool-calling
 */
export class KimiChatOpenAI extends ChatOpenAI {
  private readonly kimiFields?: ChatOpenAIFields;

  constructor(fields?: ChatOpenAIFields) {
    const kimiCompletions = new KimiChatOpenAICompletions({
      ...fields,
      useResponsesApi: false,
    } as ChatOpenAIFields);
    const kimiFields = {
      ...fields,
      useResponsesApi: false,
      completions: kimiCompletions,
    } as ChatOpenAIFields & { completions: KimiChatOpenAICompletions };
    super(kimiFields);
    this.kimiFields = kimiFields;
    this.completions = kimiCompletions;
  }

  /**
   * 克隆配置时保持 Kimi 专用 adapter，避免 LangChain bindTools 回退到原生 ChatOpenAI。
   * @keyword-en kimi-with-config-preserve-adapter
   */
  withConfig(
    config: Partial<this['ParsedCallOptions']>,
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, this['ParsedCallOptions']> {
    const newModel = new KimiChatOpenAI(this.kimiFields);
    newModel.defaultOptions = {
      ...this.defaultOptions,
      ...config,
    };
    return newModel as Runnable<
      BaseLanguageModelInput,
      AIMessageChunk,
      this['ParsedCallOptions']
    >;
  }

  invocationParams(options?: this['ParsedCallOptions']): Record<string, unknown> {
    return this.completions.invocationParams(
      this._combineCallOptions(options) as never,
    ) as Record<string, unknown>;
  }

  async _generate(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun,
  ) {
    return await this.completions._generate(messages, options as never, runManager);
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun,
  ) {
    yield* this.completions._streamResponseChunks(
      messages,
      this._combineCallOptions(options) as never,
      runManager,
    );
  }
}

/**
 * @title Kimi Chat Completions 适配器
 * @description 在 LangChain 标准 OpenAI 转换前后补齐 Kimi 的 reasoning_content 字段。
 * @keywords-cn Kimi适配器, ChatCompletions, reasoning_content
 * @keywords-en kimi-completions-adapter, chat-completions, reasoning-content
 */
class KimiChatOpenAICompletions extends ChatOpenAICompletions {
  /**
   * 非流式请求：使用 Kimi 专用消息映射，保留 assistant tool-call 的 reasoning_content。
   * @keyword-en kimi-generate-with-reasoning-content
   */
  async _generate(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun,
  ) {
    const usageMetadata: Record<string, unknown> = {};
    const params = this.invocationParams(options);
    const messagesMapped = convertKimiMessagesToCompletionsParams(
      messages,
      String(this.model),
    );

    if (params.stream) {
      const stream = this._streamResponseChunks(messages, options, runManager);
      const finalChunks: Record<string, ChatGenerationChunk> = {};
      for await (const chunk of stream) {
        chunk.message.response_metadata = {
          ...chunk.generationInfo,
          ...chunk.message.response_metadata,
        };
        const index = String(chunk.generationInfo?.completion ?? 0);
        finalChunks[index] =
          finalChunks[index] === undefined
            ? chunk
            : finalChunks[index].concat(chunk);
      }
      const generations = Object.entries(finalChunks)
        .sort(([aKey], [bKey]) => parseInt(aKey, 10) - parseInt(bKey, 10))
        .map(([, value]) => value);
      const { functions, function_call } = this.invocationParams(options) as {
        functions?: unknown[];
        function_call?: unknown;
      };
      const promptTokenUsage = await this._getEstimatedTokenCountFromPrompt(
        messages,
        functions as never,
        function_call as never,
      );
      const completionTokenUsage =
        await this._getNumTokensFromGenerations(generations);
      usageMetadata.input_tokens = promptTokenUsage;
      usageMetadata.output_tokens = completionTokenUsage;
      usageMetadata.total_tokens = promptTokenUsage + completionTokenUsage;
      return {
        generations,
        llmOutput: {
          estimatedTokenUsage: {
            promptTokens: usageMetadata.input_tokens,
            completionTokens: usageMetadata.output_tokens,
            totalTokens: usageMetadata.total_tokens,
          },
        },
      };
    }

    const data = await this.completionWithRetry(
      {
        ...params,
        stream: false,
        messages: messagesMapped,
      } as never,
      {
        signal: options?.signal,
        ...options?.options,
      },
    );
    const response = data as {
      id?: string;
      usage?: {
        completion_tokens?: number;
        prompt_tokens?: number;
        total_tokens?: number;
        prompt_tokens_details?: Record<string, unknown>;
        completion_tokens_details?: Record<string, unknown>;
      };
      choices?: Array<{
        message?: Record<string, unknown>;
        finish_reason?: string;
        logprobs?: unknown;
      }>;
    };
    const {
      completion_tokens: completionTokens,
      prompt_tokens: promptTokens,
      total_tokens: totalTokens,
    } = response?.usage ?? {};
    if (completionTokens) usageMetadata.output_tokens = completionTokens;
    if (promptTokens) usageMetadata.input_tokens = promptTokens;
    if (totalTokens) usageMetadata.total_tokens = totalTokens;

    const generations = [];
    for (const part of response?.choices ?? []) {
      const rawMessage = part.message ?? { role: 'assistant' };
      const message = this._convertCompletionsMessageToBaseMessage(
        rawMessage,
        response,
      );
      const generation = {
        text: typeof rawMessage.content === 'string' ? rawMessage.content : '',
        message,
        generationInfo: {
          ...(part.finish_reason ? { finish_reason: part.finish_reason } : {}),
          ...(part.logprobs ? { logprobs: part.logprobs } : {}),
        },
      };
      if (AIMessage.isInstance(generation.message)) {
        generation.message.usage_metadata = usageMetadata as never;
      }
      generation.message = new AIMessage(
        Object.fromEntries(
          Object.entries(generation.message).filter(
            ([key]) => !key.startsWith('lc_'),
          ),
        ) as never,
      );
      generations.push(generation);
    }
    return {
      generations,
      llmOutput: {
        tokenUsage: {
          promptTokens: usageMetadata.input_tokens,
          completionTokens: usageMetadata.output_tokens,
          totalTokens: usageMetadata.total_tokens,
        },
      },
    };
  }

  /**
   * 流式请求：使用 Kimi 专用消息映射，避免下一轮 tool-call 缺失 reasoning_content。
   * @keyword-en kimi-stream-with-reasoning-content
   */
  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun,
  ) {
    const messagesMapped = convertKimiMessagesToCompletionsParams(
      messages,
      String(this.model),
    );
    const params = {
      ...this.invocationParams(options, { streaming: true }),
      messages: messagesMapped,
      stream: true,
    };
    let defaultRole: string | undefined;
    const streamIterable = await this.completionWithRetry(params as never, options);
    let usage: Record<string, number> | undefined;
    for await (const data of streamIterable as AsyncIterable<{
      usage?: Record<string, number>;
      choices?: Array<{
        index?: number;
        delta?: Record<string, unknown>;
        finish_reason?: string | null;
        logprobs?: unknown;
      }>;
      system_fingerprint?: string;
      model?: string;
      service_tier?: string;
    }>) {
      const choice = data?.choices?.[0];
      if (data.usage) usage = data.usage;
      if (!choice?.delta) continue;
      const chunk = this._convertCompletionsDeltaToBaseMessageChunk(
        choice.delta,
        data,
        defaultRole,
      );
      defaultRole =
        typeof choice.delta.role === 'string' ? choice.delta.role : defaultRole;
      if (typeof chunk.content !== 'string') continue;
      const newTokenIndices = {
        prompt: options.promptIndex ?? 0,
        completion: choice.index ?? 0,
      };
      const generationInfo: Record<string, unknown> = { ...newTokenIndices };
      if (choice.finish_reason != null) {
        generationInfo.finish_reason = choice.finish_reason;
        generationInfo.system_fingerprint = data.system_fingerprint;
        generationInfo.model_name = data.model;
        generationInfo.service_tier = data.service_tier;
      }
      if (this.logprobs) generationInfo.logprobs = choice.logprobs;
      const generationChunk = new ChatGenerationChunk({
        message: chunk,
        text: chunk.content,
        generationInfo,
      });
      yield generationChunk;
      await runManager?.handleLLMNewToken(
        generationChunk.text ?? '',
        newTokenIndices,
        undefined,
        undefined,
        undefined,
        { chunk: generationChunk },
      );
    }
    if (usage) {
      yield new ChatGenerationChunk({
        message: new AIMessageChunk({
          content: '',
          response_metadata: { usage: { ...usage } },
          usage_metadata: {
            input_tokens: usage.prompt_tokens,
            output_tokens: usage.completion_tokens,
            total_tokens: usage.total_tokens,
          },
        }),
        text: '',
      });
    }
    if (options.signal?.aborted) throw new Error('AbortError');
  }

  /**
   * 请求发出前兜底补齐 reasoning_content，覆盖历史 checkpoint 缺字段的场景。
   * @keyword-en kimi-request-reasoning-content-fallback
   */
  async completionWithRetry(request: any, requestOptions?: any): Promise<any> {
    return await super.completionWithRetry(
      patchKimiReasoningRequest(request as KimiChatRequest) as never,
      requestOptions,
    );
  }

  protected _convertCompletionsDeltaToBaseMessageChunk(
    delta: Record<string, any>,
    rawResponse: unknown,
    defaultRole?: string,
  ) {
    const chunk = super._convertCompletionsDeltaToBaseMessageChunk(
      delta,
      rawResponse as never,
      defaultRole as never,
    );
    attachReasoningContent(chunk, delta);
    return chunk;
  }

  protected _convertCompletionsMessageToBaseMessage(
    message: unknown,
    rawResponse: unknown,
  ) {
    const msg = super._convertCompletionsMessageToBaseMessage(
      message as never,
      rawResponse as never,
    );
    attachReasoningContent(msg, message);
    return msg;
  }
}

/**
 * 转换 LangChain 消息并补回 Kimi reasoning_content。
 * @keyword-en convert-kimi-completions-messages
 */
function convertKimiMessagesToCompletionsParams(
  messages: BaseMessage[],
  model: string,
): OpenAIMessageParam[] {
  const mapped = convertMessagesToCompletionsMessageParams({
    messages,
    model,
  }) as unknown as OpenAIMessageParam[];
  const reasoningQueue = messages
    .filter((message) => AIMessage.isInstance(message) && hasToolCalls(message))
    .map((message) => extractReasoningContent(message));

  for (const message of mapped) {
    if (!isAssistantToolCallMessage(message)) continue;
    if (typeof message.reasoning_content === 'string') continue;
    const reasoning = reasoningQueue.shift();
    message.reasoning_content = reasoning ?? '';
  }
  return mapped;
}

/**
 * 对已经转换好的 OpenAI 请求做兜底修复。
 * @keyword-en patch-kimi-reasoning-request
 */
function patchKimiReasoningRequest<T extends KimiChatRequest>(request: T): T {
  if (!Array.isArray(request.messages)) return request;
  const thinkingType = request.thinking?.type;
  if (thinkingType === 'disabled') return request;
  return {
    ...request,
    messages: request.messages.map((message) => {
      if (
        !isAssistantToolCallMessage(message) ||
        typeof message.reasoning_content === 'string'
      ) {
        return message;
      }
      return { ...message, reasoning_content: '' };
    }),
  };
}

/**
 * 判断消息是否为 assistant tool-call。
 * @keyword-en assistant-tool-call-message-check
 */
function isAssistantToolCallMessage(message: OpenAIMessageParam): boolean {
  return message.role === 'assistant' && Array.isArray(message.tool_calls);
}

/**
 * 判断 LangChain AIMessage 是否带工具调用。
 * @keyword-en langchain-ai-tool-call-check
 */
function hasToolCalls(message: AIMessage): boolean {
  return (
    (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) ||
    Array.isArray(message.additional_kwargs?.tool_calls)
  );
}

/**
 * 从 LangChain 消息或 Kimi 原始响应里提取 reasoning_content。
 * @keyword-en extract-kimi-reasoning-content
 */
function extractReasoningContent(value: unknown): string | undefined {
  return findStringField(value, 'reasoning_content');
}

/**
 * 把 Kimi reasoning_content 放入 LangChain additional_kwargs，便于 checkpoint 保留。
 * @keyword-en attach-kimi-reasoning-content
 */
function attachReasoningContent(
  message: { additional_kwargs?: Record<string, unknown> },
  raw: unknown,
): void {
  const reasoning = extractReasoningContent(raw);
  if (typeof reasoning !== 'string') return;
  message.additional_kwargs = {
    ...(message.additional_kwargs ?? {}),
    reasoning_content: reasoning,
  };
}

/**
 * 深度查找 provider 私有字符串字段。
 * @keyword-en find-provider-string-field
 */
function findStringField(
  value: unknown,
  field: string,
  depth = 0,
): string | undefined {
  if (depth > 6 || value === null || typeof value !== 'object') return undefined;
  const obj = value as Record<string, unknown>;
  if (typeof obj[field] === 'string') return obj[field];
  for (const item of Object.values(obj)) {
    const found = findStringField(item, field, depth + 1);
    if (typeof found === 'string') return found;
  }
  return undefined;
}
