import type { FunctionCallDescription } from '../types';

/**
 * @title Function Call 描述：context_window_keyword
 * @desc 根据关键词获取滑动窗口的对话上下文（仅返回 JSON）。模型仅提供关键词与窗口大小，检索范围由系统侧控制。
 *       注意：sessionId 与 userId 由系统侧注入，模型不应设置或覆盖它们；includeSystem 默认 false；limit 必须填写且严格限制窗口大小。
 * @keywords-cn 函数调用, 关键词, 滑动窗口, 上下文检索, 非系统消息, 会话范围, 用户范围
 * @keywords-en function-call, keywords, sliding-window, context-retrieval, non-system, session-scope, user-scope
 */
export const ContextWindowKeywordFunctionDescription: FunctionCallDescription =
  {
    name: 'context_window_keyword',
    description:
      '根据关键词获取滑动窗口的对话上下文；返回符合条件的消息数组（JSON-only）。检索范围由系统控制（会话或用户），模型仅提供关键词与窗口大小。',
  };

/**
 * 兼容旧名称：context_keyword_window
 * 与 context_window_keyword 等价，仅用于过渡期兼容。
 */
export const ContextKeywordWindowFunctionDescription: FunctionCallDescription =
  {
    ...ContextWindowKeywordFunctionDescription,
    name: 'context_keyword_window',
  };
