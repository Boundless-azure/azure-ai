/**
 * 对话消息接口
 */
export interface ChatMessage {
  /** 消息角色 */
  role: 'system' | 'user' | 'assistant';
  /** 消息内容 */
  content: string;
  /** 时间戳 */
  timestamp?: Date;
  /** 消息元数据 */
  metadata?: Record<string, any>;
  /** 关键词分析结果（可选） */
  keywords?: { zh: string[]; en: string[] };
}

/**
 * 对话上下文接口
 */
export interface ChatContext {
  /** 会话ID */
  sessionId: string;
  /** 消息历史 */
  messages: ChatMessage[];
  /** 系统提示词 */
  systemPrompt?: string;
  /** 上下文元数据 */
  metadata?: Record<string, any>;
  /** 创建时间 */
  createdAt: Date;
  /** 最后更新时间 */
  updatedAt: Date;
}

/**
 * Prompt模板接口
 */
export interface PromptTemplate {
  /** 模板ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 模板内容 */
  template: string;
  /** 变量列表 */
  variables: string[];
  /** 模板描述 */
  description?: string;
  /** 模板分类 */
  category?: string;
  /** 是否启用 */
  enabled: boolean;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 上下文配置接口
 */
export interface ContextConfig {
  /** 最大消息数量 */
  maxMessages: number;
  /** 最大上下文长度(字符数) */
  maxContextLength?: number;
  /** 上下文过期时间(毫秒) */
  maxContextAge?: number;
  /** 清理间隔(毫秒) */
  cleanupInterval?: number;
  /** 上下文过期时间(小时) */
  expirationHours?: number;
  /** 是否自动清理 */
  autoCleanup?: boolean;
  /** 分析窗口大小（最近N条消息） */
  analysisWindowSize?: number;
}

/**
 * 消息统计接口
 */
export interface MessageStats {
  /** 总消息数 */
  totalMessages: number;
  /** 用户消息数 */
  userMessages: number;
  /** 助手消息数 */
  assistantMessages: number;
  /** 系统消息数 */
  systemMessages: number;
  /** 总字符数 */
  totalCharacters: number;
}

/**
 * 上下文摘要接口
 */
export interface ContextSummary {
  /** 会话ID */
  sessionId: string;
  /** 消息统计 */
  stats: MessageStats;
  /** 最后活动时间 */
  lastActivity: Date;
  /** 会话时长(分钟) */
  duration: number;
}
