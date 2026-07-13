/**
 * @title Anthropic 兼容端点 usage 兜底 fetch
 * @description 某些 Anthropic-compatible 端点 (如 MiniMax 的 /anthropic) 的流式 SSE 在
 *   `message_delta` 事件里**不带 `usage`**, 而 `@langchain/anthropic` 直读
 *   `data.usage.output_tokens` 且无兜底 (最新 1.5.1 仍如此) → 流式解析崩溃:
 *   `TypeError: Cannot read properties of undefined (reading 'output_tokens')`。
 *   本 fetch 包一层: 仅对 `text/event-stream` 响应逐行规整, 给缺 `usage` 的
 *   `message_delta` 注入 `{ output_tokens: 0, ... }`, 让 langchain 解析不再崩;
 *   非流式响应原样透传。不碰 node_modules, 升级 anthropic 版本不失效
 *   (与 KimiChatOpenAI 同属 provider 层适配)。
 * @keywords-cn anthropic兜底fetch, minimax流式崩溃, SSE规整, usage注入
 * @keywords-en anthropic-usage-safe-fetch, minimax-stream-crash, sse-normalize, usage-inject
 */

/** message_delta 缺 usage 时注入的占位 (覆盖 langchain 各版本读取的字段) */
const EMPTY_USAGE = {
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
} as const;

/**
 * 规整单行 SSE: 若是 `data:` 行且 JSON 为缺 usage 的 message_delta, 注入占位 usage。
 * 其余行 (event: / 空行 / [DONE] / 非 JSON) 原样返回。
 * @keyword-cn SSE行规整, message_delta补usage
 * @keyword-en normalize-sse-line, inject-message-delta-usage
 */
function normalizeSseDataLine(line: string): string {
  if (!line.startsWith('data:')) return line;
  const jsonPart = line.slice(5).trim();
  if (!jsonPart || jsonPart === '[DONE]') return line;
  try {
    const obj = JSON.parse(jsonPart) as { type?: unknown; usage?: unknown };
    if (obj?.type === 'message_delta' && obj.usage == null) {
      obj.usage = { ...EMPTY_USAGE };
      return `data: ${JSON.stringify(obj)}`;
    }
  } catch {
    // 非 JSON 的 data 行 (不该出现), 原样透传
  }
  return line;
}

/**
 * 构造字节流 TransformStream: 缓冲跨 chunk 的半行, 逐行经 normalizeSseDataLine 规整。
 * @keyword-cn SSE字节流规整, 逐行缓冲
 * @keyword-en sse-byte-transform, line-buffering
 */
function createSseUsageInjector(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  const drain = (
    controller: TransformStreamDefaultController<Uint8Array>,
    final: boolean,
  ): void => {
    let nl: number;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      controller.enqueue(encoder.encode(`${normalizeSseDataLine(line)}\n`));
    }
    if (final && buffer) {
      controller.enqueue(encoder.encode(normalizeSseDataLine(buffer)));
      buffer = '';
    }
  };
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      drain(controller, false);
    },
    flush(controller) {
      buffer += decoder.decode();
      drain(controller, true);
    },
  });
}

/** clientOptions.fetch 形参签名 (与 Anthropic SDK / 全局 fetch 兼容) */
export type AnthropicFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

/**
 * usage 兜底 fetch: 透传普通响应; 对 SSE 流注入缺失的 message_delta usage。
 * 传给 `new ChatAnthropic({ clientOptions: { fetch: anthropicUsageSafeFetch } })`。
 * @keyword-cn usage兜底fetch, 流式崩溃修复
 * @keyword-en anthropic-usage-safe-fetch, stream-crash-fix
 */
export const anthropicUsageSafeFetch: AnthropicFetch = async (input, init) => {
  const res = await fetch(input, init);
  const contentType = res.headers.get('content-type') ?? '';
  if (!res.body || !contentType.includes('text/event-stream')) return res;
  const transformed = (res.body as ReadableStream<Uint8Array>).pipeThrough(
    createSseUsageInjector(),
  );
  const headers = new Headers(res.headers);
  // 改了字节, 原 content-length / content-encoding 不再准确, 去掉以免下游严格校验
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(transformed, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
};
