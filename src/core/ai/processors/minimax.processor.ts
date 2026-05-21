import type { ChatModelProcessor } from './types';
import {
  extractMiniMaxReasoningDetails,
  extractRawDelta,
  extractReasoning,
  yieldContentText,
} from './utils';

/**
 * @title MiniMax Chat Model 处理器
 * @description 兼容 MiniMax Anthropic thinking block 与 OpenAI reasoning_split.reasoning_details。
 * @keywords-cn MiniMax处理器, 思考分离, reasoning-details
 * @keywords-en minimax-processor, thinking-separated, reasoning-details
 */
export const minimaxProcessor: ChatModelProcessor = {
  /**
   * @keyword-en minimax-process-stream-chunk
   */
  *processStreamChunk(chunk, ctx) {
    if (ctx.isSubagent) return;
    const addKw = chunk.additional_kwargs;
    const reasoning =
      extractReasoning(chunk, addKw) ||
      extractMiniMaxReasoningDetails(extractRawDelta(addKw));
    if (reasoning) yield { type: 'reasoning', data: { text: reasoning } };
    for (const text of yieldContentText(chunk.content)) {
      yield { type: 'token', data: { text } };
    }
    if (chunk.additional_kwargs) {
      delete chunk.additional_kwargs['__raw_response'];
    }
  },
};
