import type { AIMessageChunk } from '@langchain/core/messages';
import type { ModelSseEvent } from '../types/ai-model.types';

/**
 * @title Chat Model Processor 上下文
 * @description 主流程注入的运行期状态, processor 不持有跨 chunk 状态.
 * @keywords-cn 处理器上下文, 主代理
 * @keywords-en chunk-context, is-subagent
 */
export interface ChunkContext {
  /** LangGraph subagent 子图的 chunk 通常不应外溢, 主流程已根据 tags 判定 */
  isSubagent: boolean;
}

/**
 * @title Chat Model Processor 接口
 * @description 把 LangChain 的 on_chat_model_stream chunk 转换为 ModelSseEvent 迭代器,
 *              每个 provider 实现自己的字段映射, 主流程不感知 provider 差异.
 *              tool_call_chunks / on_tool_end 由主流程统一处理 (provider 间无差异).
 *              注意 :: 不处理 on_chat_model_end —— 流式 chunks 已传完完整内容,
 *              model_end 的聚合 output 只是视图, 再 yield 会与 stream 重复发送.
 * @keywords-cn 处理器接口, 流式分发, 模型适配
 * @keywords-en processor-interface, stream-dispatch, model-adapter
 */
export interface ChatModelProcessor {
  /**
   * 处理 on_chat_model_stream chunk, 0..N 个事件 (空迭代代表 chunk 是元数据噪音)
   * @keyword-en process-stream-chunk
   */
  processStreamChunk(
    chunk: AIMessageChunk,
    ctx: ChunkContext,
  ): Generator<ModelSseEvent>;
}
