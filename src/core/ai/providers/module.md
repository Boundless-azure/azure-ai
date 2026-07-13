# AI Providers 模块

## 功能描述

封装特定模型提供商的 LangChain 适配逻辑，避免通用 AIModelService 直接承载 provider 私有协议细节。

## 文件清单

- `kimi-chat-openai.ts` - Kimi / Moonshot OpenAI-compatible 专用适配器，保留并回放 thinking + tool calling 所需的 `reasoning_content`。
- `anthropic-usage-safe-fetch.ts` - Anthropic 兼容端点 (MiniMax /anthropic 等) 的 usage 兜底 fetch：SSE 流里给缺 `usage` 的 `message_delta` 注入占位，修复 `@langchain/anthropic` 直读 `data.usage.output_tokens` 的流式崩溃。

## 函数清单

- `KimiChatOpenAI`
  - `constructor(fields?)`：创建禁用 Responses API 的 Kimi ChatOpenAI 包装实例。
  - `withConfig(config)`：克隆配置时保持 Kimi 专用 adapter，避免 LangChain bindTools 回退原生 ChatOpenAI。
  - `invocationParams(options?)`：强制走 Kimi completions adapter 的请求参数构造。
  - `_generate(messages, options, runManager?)`：强制走 Kimi completions adapter。
  - `_streamResponseChunks(messages, options, runManager?)`：强制走 Kimi completions adapter。
- `KimiChatOpenAICompletions`
  - `_generate(messages, options, runManager?)`：非流式请求保留 Kimi `reasoning_content`。
  - `_streamResponseChunks(messages, options, runManager?)`：流式请求保留 Kimi `reasoning_content`。
  - `completionWithRetry(request, requestOptions?)`：请求发出前补齐 assistant tool-call message 的 `reasoning_content`。
  - `_convertCompletionsDeltaToBaseMessageChunk(delta, rawResponse, defaultRole?)`：从 Kimi delta 提取 `reasoning_content`。
  - `_convertCompletionsMessageToBaseMessage(message, rawResponse)`：从 Kimi message 提取 `reasoning_content`。
- `convertKimiMessagesToCompletionsParams(messages, model)`：转换 LangChain 消息并补回 Kimi `reasoning_content`。
- `patchKimiReasoningRequest(request)`：兜底修复已转换请求里的 assistant tool-call message。
- `isAssistantToolCallMessage(message)`：判断 OpenAI message 是否为 assistant tool-call message。
- `hasToolCalls(message)`：判断 LangChain AIMessage 是否包含工具调用。
- `extractReasoningContent(value)`：提取 Kimi `reasoning_content`。
- `attachReasoningContent(message, raw)`：把 Kimi `reasoning_content` 写入 LangChain additional_kwargs。
- `findStringField(value, field, depth?)`：深度查找 provider 私有字符串字段。
- `anthropicUsageSafeFetch(input, init?)`：usage 兜底 fetch，透传普通响应、对 SSE 流规整；传给 `ChatAnthropic({ clientOptions: { fetch } })` | keywords: anthropic-usage-safe-fetch, stream-crash-fix。
- `normalizeSseDataLine(line)`：单行 SSE 规整，给缺 usage 的 message_delta 注入占位 | keywords: normalize-sse-line, inject-message-delta-usage。
- `createSseUsageInjector()`：字节流 TransformStream，缓冲半行逐行规整 | keywords: sse-byte-transform, line-buffering。

## 关键词索引

- kimi-chat-openai -> `kimi-chat-openai.ts`
- kimi-completions-adapter -> `kimi-chat-openai.ts`
- reasoning-content -> `kimi-chat-openai.ts`
- tool-calling -> `kimi-chat-openai.ts`
- anthropic-usage-safe-fetch -> `anthropic-usage-safe-fetch.ts`
- minimax-stream-crash -> `anthropic-usage-safe-fetch.ts`
- sse-normalize -> `anthropic-usage-safe-fetch.ts`

## 函数哈希映射

- `KimiChatOpenAICompletions._generate` -> `kimi-generate-with-reasoning-content`
- `KimiChatOpenAICompletions._streamResponseChunks` -> `kimi-stream-with-reasoning-content`
- `KimiChatOpenAICompletions.completionWithRetry` -> `kimi-request-reasoning-content-fallback`
- `KimiChatOpenAI.withConfig` -> `kimi-with-config-preserve-adapter`
- `convertKimiMessagesToCompletionsParams` -> `convert-kimi-completions-messages`
- `patchKimiReasoningRequest` -> `patch-kimi-reasoning-request`
