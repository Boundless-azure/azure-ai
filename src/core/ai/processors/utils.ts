/**
 * @title Processor 共享工具
 * @description 各 provider processor 复用的字段提取函数, 隔离重复的 fallback 检测逻辑.
 * @keywords-cn 字段提取, 推理内容, 原始响应, 兜底字段
 * @keywords-en field-extract, reasoning-content, raw-response, fallback
 */

/**
 * 从 additional_kwargs / chunk.content 数组提取 reasoning 文本.
 * 各 provider 字段名差异大, 此处做多 candidate 联合识别:
 *  - DeepSeek-R1     :: additional_kwargs.reasoning_content
 *  - OpenAI o-series :: additional_kwargs.reasoning_content / reasoning
 *  - Gemini 2.5      :: additional_kwargs.thoughts
 *  - Anthropic 4.x   :: chunk.content 数组中 { type: 'thinking', thinking } block
 * @keyword-en extract-reasoning
 */
export function extractReasoning(
  chunk: { content?: unknown },
  addKw?: Record<string, unknown>,
): string | null {
  const stringCandidates: Array<unknown> = [
    addKw?.['reasoning_content'],
    addKw?.['reasoning'],
    addKw?.['thinking_content'],
    addKw?.['thinking'],
    addKw?.['thoughts'],
  ];
  for (const v of stringCandidates) {
    if (typeof v === 'string' && v.length > 0) return v;
  }
  if (Array.isArray(chunk.content)) {
    const parts: string[] = [];
    for (const block of chunk.content) {
      if (block && typeof block === 'object') {
        const obj = block as { type?: string; thinking?: string };
        if (obj.type === 'thinking' && typeof obj.thinking === 'string') {
          parts.push(obj.thinking);
        }
      }
    }
    if (parts.length > 0) return parts.join('');
  }
  return null;
}

/**
 * 从 __raw_response 提取 SSE delta 对象.
 * 依赖 :: ChatOpenAI 构造时传入 __includeRawResponse: true (见 ai-model.service.ts createModelInstance).
 * 用于读取 LangChain 标准 converter 没解析的非标准字段 (Qwen 的 reasoning_content 等).
 * @keyword-en extract-raw-delta
 */
export function extractRawDelta(
  addKw?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const rawResp = addKw?.['__raw_response'] as
    | { choices?: Array<{ delta?: Record<string, unknown> }> }
    | undefined;
  return rawResp?.choices?.[0]?.delta;
}

/**
 * 从 chunk.content (string | array) 顺序产出 text 片段, 空串忽略.
 *  - string :: 整段
 *  - array  :: 遍历 { type: 'text', text } block
 * 数组中的非 text block (tool_use / thinking 等) 跳过, 由专门路径处理.
 * @keyword-en yield-content-text
 */
export function* yieldContentText(content: unknown): Generator<string> {
  if (typeof content === 'string') {
    if (content.length > 0) yield content;
    return;
  }
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block && typeof block === 'object') {
        const b = block as { type?: string; text?: string };
        if (
          b.type === 'text' &&
          typeof b.text === 'string' &&
          b.text.length > 0
        ) {
          yield b.text;
        }
      }
    }
  }
}
