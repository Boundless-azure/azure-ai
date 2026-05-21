import type { ChatModelProcessor } from './types';
import { extractRawDelta, yieldContentText } from './utils';

/**
 * @title Reasoning 模型 chunk 处理器
 * @description 适用所有"reasoning_content 字段表示真思考过程"的 OpenAI 兼容服务:
 *   - DeepSeek-R1 (deepseek-reasoner)
 *   - NVIDIA NIM 上的 reasoning 模型 (Qwen3 / QwQ / DeepSeek-R1 NV 部署 等)
 *   - 其它把 reasoning 走 __raw_response.delta.reasoning_content 透传的服务
 * 字段映射 ::
 *   - 思考阶段 :: delta.reasoning_content = "思考过程", delta.content = null / ""  → yield reasoning
 *   - 回复阶段 :: delta.content = "正式回复"                                        → yield token
 * 严格分离, 思考不污染 token 流 (dialogues 只消费 token 时自然只拿到对话内容).
 * 注意 :: 跟"错位"模型 (Qwen3.5-122b-a10b 那种把回复正文也塞 reasoning_content) 的兜底策略不同,
 *        错位 case 现已不支持; 如需可加 model.metadata 开关或单写一个 misaligned processor.
 * @keywords-cn 推理模型, 思考分离, R1, NIM, reasoning_content
 * @keywords-en reasoning-processor, thinking-separated, deepseek-r1, nim
 */
export const reasoningProcessor: ChatModelProcessor = {
  /**
   * @keyword-en reasoning-process-stream-chunk
   */
  *processStreamChunk(chunk, ctx) {
    if (ctx.isSubagent) return;
    const delta = extractRawDelta(chunk.additional_kwargs);
    const rc = delta?.['reasoning_content'];
    if (typeof rc === 'string' && rc.length > 0) {
      yield { type: 'reasoning', data: { text: rc } };
    }
    for (const text of yieldContentText(chunk.content)) {
      yield { type: 'token', data: { text } };
    }
    // 拿完 reasoning_content 立即删除 __raw_response, 避免 LangChain 后续 chunk merge 时
    // 撞到 number 类型字段 (created / index) 抛 "field[xxx] ... unsupported type" warning.
    if (chunk.additional_kwargs) {
      delete chunk.additional_kwargs['__raw_response'];
    }
  },
};
