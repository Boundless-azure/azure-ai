/**
 * @title 天维度键
 * @description 按天维度的字符串键，格式 YYYY-MM-DD
 * @keywords-cn 天维度, 日期键
 * @keywords-en day-dimension, date-key
 */
export type DayKey = string; // e.g. '2025-12-04'

/**
 * @title 分段创建请求体
 * @keywords-cn 分段创建, 请求体
 * @keywords-en segment-create, payload
 */
export interface CreateSegmentRequest {
  name: string;
  description?: string;
  messageIds: string[];
}

/**
 * @title 分段更新请求体
 * @keywords-cn 分段更新, 请求体
 * @keywords-en segment-update, payload
 */
export interface UpdateSegmentRequest {
  name?: string;
  description?: string;
  messageIds?: string[];
}

/**
 * @title 分段响应体
 * @keywords-cn 分段响应
 * @keywords-en segment-response
 */
export interface SegmentResponse {
  id: string;
  sessionId: string;
  day: DayKey;
  name: string;
  description?: string | null;
  messageIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * @title 天维度索引响应
 * @keywords-cn 天索引, 消息统计
 * @keywords-en day-index, message-stats
 */
export interface DayIndexResponse {
  sessionId: string;
  days: Array<{ day: DayKey; count: number }>;
}

/**
 * @title 指定天的消息列表响应
 * @keywords-cn 天消息, 列表响应
 * @keywords-en day-messages, list-response
 */
export interface DayMessagesResponse {
  sessionId: string;
  day: DayKey;
  messages: Array<{
    id: string;
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
}

/**
 * @title 指定天的分段列表响应
 * @keywords-cn 天分段, 列表响应
 * @keywords-en day-segments, list-response
 */
export interface DaySegmentsResponse {
  sessionId: string;
  day: DayKey;
  segments: SegmentResponse[];
}

/**
 * @title 指定天对应的会话列表
 * @keywords-cn 天反查会话, 会话列表
 * @keywords-en day-to-sessions, session-list
 */
export interface DaySessionsResponse {
  day: DayKey;
  sessions: Array<{ sessionId: string; count: number }>;
}
