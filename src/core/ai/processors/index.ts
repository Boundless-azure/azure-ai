/**
 * @title Chat Model Processor Registry
 * @description 按 provider 路由到对应 ChatModelProcessor; 默认走 defaultProcessor.
 *              新增 provider 三种情况 ::
 *                1. 标准 LangChain 字段就 work :: 啥也不用做 (走 default)
 *                2. 需要特殊字段提取 :: 沿用或新建 processor + 此处 case 指定
 *                3. 需要全新构造逻辑 :: 同时改 ai-model.service.ts 的 createModelInstance
 *              ai-model.service.ts 主流程永远不感知 provider 差异.
 * @keywords-cn 处理器注册, provider 路由, 默认兜底
 * @keywords-en processor-registry, provider-routing, default-fallback
 */
import type { AIModelEntity } from '../entities';
import type { ChatModelProcessor } from './types';
import { defaultProcessor } from './default.processor';
import { reasoningProcessor } from './reasoning.processor';
import { minimaxProcessor } from './minimax.processor';

/**
 * 仅列出"行为偏离 LangChain 标准映射"的 provider; 其余全部走 default.
 *  - deepseek :: R1 把思考过程塞 __raw_response.delta.reasoning_content (LangChain 标准 converter 不读)
 *  - nvidia   :: NIM 主流 reasoning 模型 (QwQ / Qwen3 / R1 NV 部署) 同 R1 风格, 思考严格分离
 *  - minimax  :: OpenAI reasoning_split 走 delta.reasoning_details; Anthropic 走 thinking block
 * @keyword-en provider-specialization
 */
const PROVIDER_PROCESSORS: Record<string, ChatModelProcessor> = {
  deepseek: reasoningProcessor,
  minimax: minimaxProcessor,
  nvidia: reasoningProcessor,
};

/**
 * 根据模型配置选择 processor, 未注册的 provider 走 defaultProcessor.
 * @keyword-en select-processor
 */
export function selectProcessor(config: AIModelEntity): ChatModelProcessor {
  return PROVIDER_PROCESSORS[config.provider] ?? defaultProcessor;
}

export type { ChatModelProcessor, ChunkContext } from './types';
