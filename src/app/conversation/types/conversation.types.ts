/**
 * 对话模块类型与运行时守卫
 *
 * 说明：
 * - 本文件集中声明对话模块使用的请求/响应类型，以及针对外部函数调用参数的运行时类型守卫（type guards）。
 * - 通过将类型与守卫集中在 types 目录，降低 service 的复杂度，提升复用与可读性。
 *
 * @category Conversation
 * @keywords Conversation, Stream, SSE, FunctionCall, Orchestrator, Mysql, KeywordWindow
 * 关键词: 对话, 流式, SSE, 函数调用, 编排器, MySQL, 关键词窗口
 */

import type { AIModelResponse } from '@core/ai';
import type { OrchestratorParams } from '@core/function-call';
import type { FunctionCallDescription } from '@core/function-call/descriptions';

/**
 * 附加在消息上的元数据结构。
 */
export interface MessageMetadata {
  type?: string;
  functionCalls?: any[];
  [key: string]: any;
}

/**
 * AI 模型返回的工具调用描述。
 */
export interface FunctionCall {
  name: string;
  arguments: unknown;
}

/**
 * 扩展后的 AI 响应类型，包含可选的工具调用列表。
 */
export interface AIModelResponseWithFunctionCalls extends AIModelResponse {
  functionCalls?: FunctionCall[];
}

// -------------------------
// Function Call 注册相关类型（供 ConversationService 使用）
// -------------------------

/**
 * 函数调用参数校验器：返回 true 表示通过校验。
 */
export type ToolValidator = (args: unknown) => boolean;

/**
 * 函数调用执行器：执行并返回结果；可选地接收会话上下文。
 */
export type ToolExecutor = (
  args: unknown,
  ctx?: { sessionId?: string },
) => Promise<unknown>;

/**
 * 函数注册表条目：包含名称、描述、校验器与执行器。
 */
export interface FunctionRegistryEntry {
  name: string;
  description: FunctionCallDescription;
  validate: ToolValidator;
  execute: ToolExecutor;
}

/**
 * 标准对话请求。
 */
export interface ChatRequest {
  message: string;
  sessionId?: string;
  modelId?: string;
  systemPrompt?: string;
  stream?: boolean;
}

/** 创建会话请求 */
export interface CreateSessionRequest {
  systemPrompt?: string;
  modelId?: string;
}

/** 获取历史记录请求 */
export interface GetHistoryRequest {
  sessionId: string;
  limit?: number;
}

/**
 * 标准对话响应。
 */
export interface ChatResponse {
  sessionId: string;
  message: string;
  model: string;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

/**
 * 流式响应分片。
 */
export interface StreamChunk {
  type: 'content' | 'done' | 'error';
  content?: string;
  sessionId?: string;
  error?: string;
}

/** 创建会话响应 */
export interface CreateSessionResponse {
  sessionId: string;
  message: string;
}

/** 获取历史记录响应 */
export interface GetHistoryResponse {
  sessionId: string;
  messages: Array<{
    role: string;
    content: string;
    timestamp: Date;
    metadata?: MessageMetadata;
  }>;
}

// -------------------------
// 运行时类型守卫（Type Guards）
// -------------------------

/**
 * 判断值是否为非 null 的对象。
 */
export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/**
 * 判断值是否为字符串数组。
 */
export function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

/**
 * 判断参数是否符合插件编排器的 OrchestratorParams 结构。
 * - phase 必须为 'plan' 或 'generate'
 * - modelId 为字符串
 * - input 为对象
 * - generate 阶段要求存在 plan 对象
 */
export function isOrchestratorParams(v: unknown): v is OrchestratorParams {
  if (!isObject(v)) return false;
  const phase = v['phase'];
  const modelId = v['modelId'];
  const input = v['input'];
  if (phase !== 'plan' && phase !== 'generate') return false;
  if (typeof modelId !== 'string') return false;
  if (!isObject(input)) return false;
  if (phase === 'generate' && !isObject(v['plan'])) return false;
  return true;
}

/**
 * 判断参数是否符合只读 MySQL SELECT 的要求。
 * - sql 为字符串
 * - limit 为数字
 * - params 为可选的数组
 */
export function isMysqlSelectArgs(v: unknown): v is {
  sql: string;
  params?: Array<string | number | boolean | null>;
  limit: number;
} {
  if (!isObject(v)) return false;
  const sql = v['sql'];
  const limit = v['limit'];
  const params = v['params'];
  if (typeof sql !== 'string') return false;
  if (typeof limit !== 'number') return false;
  if (params !== undefined) {
    if (!Array.isArray(params)) return false;
    const isPrimitive = (x: unknown): x is string | number | boolean | null =>
      x === null ||
      ['string', 'number', 'boolean'].includes(typeof x as string);
    if (!params.every(isPrimitive)) return false;
  }
  return true;
}

/**
 * 判断参数是否符合基于关键词的上下文窗口检索要求。
 * - keywords 为字符串数组
 * - limit 为数字
 * - includeSystem 可选布尔值
 * - matchMode 可选，取值为 'any' 或 'all'
 */
export function isKeywordWindowArgs(v: unknown): v is {
  sessionId?: string;
  keywords: string[];
  limit: number;
  includeSystem?: boolean;
  matchMode?: 'any' | 'all';
} {
  if (!isObject(v)) return false;
  const keywords = v['keywords'];
  const limit = v['limit'];
  const includeSystem = v['includeSystem'];
  const matchMode = v['matchMode'];
  if (!isStringArray(keywords)) return false;
  if (typeof limit !== 'number') return false;
  if (includeSystem !== undefined && typeof includeSystem !== 'boolean')
    return false;
  if (matchMode !== undefined && matchMode !== 'any' && matchMode !== 'all')
    return false;
  return true;
}
