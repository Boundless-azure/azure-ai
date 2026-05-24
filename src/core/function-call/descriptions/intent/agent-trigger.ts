import type { FunctionCallDescription } from '../types';

/**
 * @title Function Call 描述：intent_agent_trigger
 * @desc 基于当前会话消息与已注册 Agent 信息进行意图分析，判断是否应唤起某个 Agent 并可选创建执行记录以开始 Agent 对话。
 * @keywords-cn 函数调用, 意图分析, Agent唤起, 对话启动
 * @keywords-en function-call, intent-analysis, agent-trigger, dialogue-start
 */
export const IntentAgentTriggerFunctionDescription: FunctionCallDescription = {
  name: 'intent_agent_trigger',
  description:
    '根据模型提供的关键词集合进行向量检索（pgvector 优先，关键词匹配回退），返回最相关的 Agent；当分数达到阈值（默认0.35，向量检索场景）时认为触发，可在存在有效会话时创建执行记录并启动 Agent 对话（JSON-only）。参数：keywords（必填），message（可选），threshold/topK/requireStart。',
};
