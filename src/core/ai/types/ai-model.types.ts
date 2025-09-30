/**
 * AI模型提供商枚举
 */
export enum AIProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  GEMINI = 'gemini',
  DEEPSEEK = 'deepseek',
}

/**
 * AI模型类型枚举
 */
export enum AIModelType {
  CHAT = 'chat',
  COMPLETION = 'completion',
  EMBEDDING = 'embedding',
}

/**
 * AI模型状态枚举
 */
export enum AIModelStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DEPRECATED = 'deprecated',
  MAINTENANCE = 'maintenance',
}

/**
 * Azure OpenAI 特定配置接口
 */
export interface AzureOpenAIConfig {
  /** Azure OpenAI 资源名称 */
  resourceName: string;
  /** 部署名称 */
  deploymentName: string;
  /** API版本 */
  apiVersion: string;
}

/**
 * 模型参数接口
 */
export interface ModelParameters {
  /** 最大token数 */
  maxTokens?: number;
  /** 温度参数 */
  temperature?: number;
  /** top_p参数 */
  topP?: number;
  /** 频率惩罚 */
  frequencyPenalty?: number;
  /** 存在惩罚 */
  presencePenalty?: number;
}

/**
 * AI模型配置接口
 */
export interface AIModelConfig {
  /** 模型唯一标识 */
  id: string;
  /** 模型名称 */
  name: string;
  /** 模型显示名称 */
  displayName?: string;
  /** 提供商 */
  provider: AIProvider;
  /** 模型类型 */
  type: AIModelType;
  /** 模型状态 */
  status: AIModelStatus;
  /** API密钥 */
  apiKey: string;
  /** 基础URL (可选) */
  baseURL?: string;
  /** Azure OpenAI 特定配置 */
  azureConfig?: AzureOpenAIConfig;
  /** 默认模型参数 */
  defaultParams?: ModelParameters;
  /** 模型描述 */
  description?: string;
  /** 是否启用 */
  enabled: boolean;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * Token使用统计接口
 */
export interface TokenUsage {
  /** 提示词token数 */
  prompt: number;
  /** 完成token数 */
  completion: number;
  /** 总token数 */
  total: number;
}

// 新增：模型响应的 token 使用元信息类型（与各提供商返回结构对齐）
export interface ModelTokenUsageMeta {
  /** 提示词token数（提供商返回的原始字段） */
  promptTokens?: number;
  /** 完成token数（提供商返回的原始字段） */
  completionTokens?: number;
  /** 总token数（提供商返回的原始字段） */
  totalTokens?: number;
}

// 新增：绑定到模型调用时的参数（按提供商字段名统一约束）
export interface ModelBindParams {
  /** 温度参数 */
  temperature?: number;
  /** top_p参数 */
  topP?: number;
  /** 非Google模型的最大token数 */
  maxTokens?: number;
  /** Google模型的最大输出token数 */
  maxOutputTokens?: number;
}

/**
 * AI模型响应接口
 */
export interface AIModelResponse {
  /** 响应内容 */
  content: string;
  /** 使用的token数 */
  tokensUsed?: TokenUsage;
  /** 模型信息 */
  model: string;
  /** 响应时间(毫秒) */
  responseTime: number;
  /** 请求ID */
  requestId?: string;
  /** 完成原因 */
  finishReason?: string;
}

/**
 * 消息角色类型
 */
export type MessageRole = 'system' | 'user' | 'assistant';

/**
 * 聊天消息接口
 */
export interface ChatMessage {
  /** 消息角色 */
  role: MessageRole;
  /** 消息内容 */
  content: string;
}

/**
 * AI模型请求接口
 */
export interface AIModelRequest {
  /** 模型ID */
  modelId: string;
  /** 消息内容 */
  messages: ChatMessage[];
  /** 请求参数 */
  params?: ModelParameters & {
    /** 是否流式响应 */
    stream?: boolean;
    /** 停止词 */
    stop?: string[];
  };
  /** 用户ID (可选) */
  userId?: string;
  /** 会话ID (可选) */
  sessionId?: string;
}

/**
 * 流式响应数据接口
 */
export interface StreamResponse {
  /** 增量内容 */
  delta: string;
  /** 是否完成 */
  done: boolean;
  /** 完整响应 (仅在done=true时提供) */
  response?: AIModelResponse;
}
