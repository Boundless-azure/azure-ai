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
    parameters: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description:
            '会话唯一标识（可选；仅由系统侧注入，不由模型提供或覆盖）。存在时仅在该会话内检索，否则按用户范围检索。',
        },
        keywords: {
          type: 'array',
          description: '关键词列表（模型根据当前提问主题判定并填写）。',
          items: { type: 'string' },
        },
        limit: {
          type: 'number',
          description:
            '窗口大小上限（必填；系统强制限制返回消息数量不超过该值）。',
        },
        includeSystem: {
          type: 'boolean',
          description:
            '是否在结果前置系统消息（可选；默认 false；避免系统消息挤占窗口）。',
          default: false,
        },
        matchMode: {
          type: 'string',
          description:
            "关键词匹配模式（可选）：'any' 表示至少命中一个；'all' 表示必须全部命中。",
          enum: ['any', 'all'],
          default: 'any',
        },
      },
      required: ['keywords', 'limit'],
    },
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
