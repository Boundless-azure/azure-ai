import type { ChatModelProcessor } from './types';
import { extractReasoning, yieldContentText } from './utils';

/**
 * @title 默认 Chat Model 处理器
 * @description 标准 LangChain 字段映射, 适用所有"按规矩出牌"的 provider:
 *   - OpenAI / Azure OpenAI (gpt-* / o-series)
 *   - Anthropic Claude (含 4.x extended thinking, 数组 content 内的 text/thinking block 已在 utils 处理)
 *   - Google / Gemini (含 2.5 thinking 的 additional_kwargs.thoughts)
 *   - Kimi / Moonshot (OpenAI 兼容协议)
 *   - custom (openai 协议) / custom (anthropic 协议)
 * 提取规则 ::
 *   - reasoning :: additional_kwargs 各种 fallback 字段名 + chunk.content 数组中 thinking block
 *   - token     :: chunk.content 字符串非空 + 数组中 type='text' block
 * 真正非标准的 provider (DeepSeek-R1 / NVIDIA NIM 错位) 写自己的 processor.
 * @keywords-cn 默认处理器, 标准映射, 通用基线
 * @keywords-en default-processor, standard-mapping, baseline
 */
export const defaultProcessor: ChatModelProcessor = {
  /**
   * @keyword-en default-process-stream-chunk
   */
  *processStreamChunk(chunk, ctx) {
    if (ctx.isSubagent) return;
    const addKw = chunk.additional_kwargs;
    const reasoning = extractReasoning(chunk, addKw);
    if (reasoning) yield { type: 'reasoning', data: { text: reasoning } };
    for (const text of yieldContentText(chunk.content)) {
      yield { type: 'token', data: { text } };
    }
  },
};
