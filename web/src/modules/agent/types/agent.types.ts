/**
 * @title Agent Types
 * @description Definitions for Agent module types.
 * @keywords-cn 代理类型, 聊天消息, 工作流状态
 * @keywords-en agent-types, chat-message, workflow-status
 */

import {
  ChatRole,
  ToolCallStatus,
  WorkflowStepStatus,
  QuickItemType,
  WorkflowNodeType,
  WorkflowNodeStatus,
  WorkflowEdgeStatus,
  WorkflowGraphStatus,
} from '../enums/agent.enums';
import { z } from 'zod';

export interface ToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string
  status: ToolCallStatus;
  result?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  tool_calls?: ToolCall[];
  senderId?: string | null;
  senderName?: string;
  status?: 'sending' | 'sent' | 'error';
}

/**
 * @title Chat Attachment
 * @description Attachment for chat messages (images currently supported).
 * @keywords-cn 聊天附件, 图片
 * @keywords-en chat-attachment, image
 */
export interface Attachment {
  file: File;
  preview: string;
}

export interface WorkflowStep {
  id: string;
  title: string;
  status: WorkflowStepStatus;
}

export interface QuickItem {
  id: string;
  title: string;
  icon: string;
  type: QuickItemType;
}

export interface WorkflowNode {
  id: string;
  label: string;
  type: WorkflowNodeType;
  status: WorkflowNodeStatus;
  x: number;
  y: number;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  status: WorkflowEdgeStatus;
  label?: string;
}

export interface WorkflowGraph {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  status: WorkflowGraphStatus;
  currentStep?: string;
}

export interface Checkpoint {
  id: string;
  thread_id: string;
  created_at: string;
  [key: string]: unknown;
}

export interface CheckpointListItem {
  checkpointId: string;
  ts: string;
  metadata?: Record<string, unknown>;
}

export interface CheckpointListResponse {
  threadId: string;
  items: CheckpointListItem[];
}

// --- Group API Types ---

export interface GroupListItem {
  id: string;
  dayGroupId: string;
  title: string | null;
  chatClientId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  latestMessage?: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
  };
  threadType?: 'assistant' | 'system' | 'todo' | 'group' | 'dm';
  isPinned?: boolean;
  isAiInvolved?: boolean;
  participants?: Array<Participant> | string[];
}

/**
 * @title Group List Query
 * @description 对话组列表查询参数（支持按日期或日分组ID筛选）。
 * @keywords-cn 对话组列表查询, 日期筛选, 日分组ID
 * @keywords-en group-list-query, date-filter, day-group-id
 */
export interface GroupListQueryDto {
  date?: string;
  dayGroupId?: string;
}

export interface SessionListItem {
  id: string;
  title: string | null;
  chatClientId: string | null;
  threadType: 'assistant' | 'system' | 'todo' | 'group' | 'dm';
  isPinned: boolean;
  isFixedEntry?: boolean;
  isAiInvolved: boolean;
  unreadCount?: number;
  workflowStatus?: 'running' | 'idle' | 'error' | 'completed';
  lastMessage?: string;
  avatarUrl?: string | null;
  members?: string[]; // Array of avatar URLs or names/initials
  createdAt: string;
  updatedAt: string;
}

export type ThreadListItem = SessionListItem;

export interface Participant {
  id: string;
  name?: string;
}

/**
 * @title Identity Principal (Contact)
 * @description 统一主体（通讯录项）基本信息。
 * @keywords-cn 主体, 通讯录
 * @keywords-en principal, contact
 */
export interface IdentityPrincipalItem {
  id: string;
  displayName: string;
  principalType:
    | 'user_enterprise'
    | 'user_consumer'
    | 'official_account'
    | 'agent'
    | 'system';
  avatarUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  tenantId?: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface GroupDetailResponse {
  id: string;
  dayGroupId: string;
  title: string | null;
  chatClientId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  sessionCount: number;
}

export interface CreateGroupRequest {
  date?: string;
  dayGroupId?: string;
  title?: string | null;
  chatClientId?: string | null;
}

export interface CreateGroupResponse {
  id: string;
  dayGroupId: string;
}

export interface UpdateGroupRequest {
  title?: string | null;
  active?: boolean;
  chatClientId?: string | null;
}

export interface DailyTodo {
  id: number | string;
  title: string;
  completed?: boolean;
}

export interface DailyPluginUsage {
  id: number | string;
  name: string;
  icon: string;
  count: number;
}

export interface DailyReportContent {
  summary: string;
  todos: DailyTodo[];
  plugins: DailyPluginUsage[];
}

/**
 * @title Summary Item
 * @description 对话阶段性摘要项（通常每 N 轮一次）。
 * @keywords-cn 摘要项, 轮次, 会话ID
 * @keywords-en summary-item, round-number, session-id
 */
export interface SummaryItem {
  sessionId: string;
  roundNumber: number;
  summaryContent: string;
  createdAt: string;
}

/**
 * @title Summaries By Group Response
 * @description 指定对话组的阶段性摘要列表。
 * @keywords-cn 组摘要, 列表
 * @keywords-en group-summaries, list
 */
export interface SummariesByGroupResponse {
  groupId: string;
  items: SummaryItem[];
}

export interface GroupHistoryItem {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface GroupHistoryResponse {
  groupId: string;
  items: GroupHistoryItem[];
}

/**
 * @title Session History Message
 * @description 单个会话历史消息项。
 * @keywords-cn 会话历史, 消息
 * @keywords-en session-history, message
 */
export interface SessionHistoryMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: string | Date;
  metadata?: Record<string, unknown>;
}

/**
 * @title Session History Response
 * @description 会话历史响应结构，与后端 /conversation/sessions/:sessionId/history 对齐。
 * @keywords-cn 会话历史响应
 * @keywords-en session-history-response
 */
export interface SessionHistoryResponse {
  sessionId: string;
  messages: SessionHistoryMessage[];
}

export interface Agent {
  id: string;
  nickname: string;
  purpose: string;
  vector_id?: string;
  code_path?: string;
  is_ai_generated: boolean;
  nodes: any;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAgentRequest {
  nickname?: string;
  purpose?: string;
}

export interface ActiveWorkflowCard {
  id: string;
  name: string;
  node: string;
  status: WorkflowGraphStatus;
}

/**
 * @title Agent API Schemas
 * @description Zod 校验：前端 Agent 模块请求参数。
 * @keywords-cn 代理请求校验, Zod
 * @keywords-en agent-request-schemas, zod
 */
export const SendMessageSchema = z.object({
  content: z.string().min(1),
  sessionId: z.string().optional(),
});

export const PostThreadMessageSchema = z.object({
  content: z.string().min(1),
  sessionId: z.string().optional(),
  principalId: z.string().optional(),
});

export const GetGroupHistoryParamsSchema = z.object({
  limit: z.number().int().min(1).max(2000).optional(),
  includeSystem: z.boolean().optional(),
  since: z.string().optional(),
  principalId: z.string().optional(),
});

export const GetGroupListParamsSchema = z.object({
  date: z.string().optional(),
  dayGroupId: z.string().optional(),
});

export const CreateGroupRequestSchema = z.object({
  date: z.string().optional(),
  dayGroupId: z.string().optional(),
  title: z.string().nullable().optional(),
  chatClientId: z.string().nullable().optional(),
});

export const UpdateGroupRequestSchema = z.object({
  title: z.string().nullable().optional(),
  active: z.boolean().optional(),
  chatClientId: z.string().nullable().optional(),
});

export const UpdateAgentRequestSchema = z.object({
  nickname: z.string().optional(),
  purpose: z.string().optional(),
});

export const ListThreadsParamsSchema = z.object({
  type: z
    .union([
      z.literal('assistant'),
      z.literal('system'),
      z.literal('todo'),
      z.literal('group'),
      z.literal('dm'),
    ])
    .optional(),
  ai: z.boolean().optional(),
  pinned: z.boolean().optional(),
  q: z.string().optional(),
  principalId: z.string().optional(),
});

export const UpdateEmbeddingsSchema = z.object({
  ids: z.array(z.string()).min(1).optional(),
});

/**
 * @title Agent Socket Schemas
 * @description Zod 校验：WebSocket 启动载荷与事件。
 * @keywords-cn WebSocket校验, 事件校验
 * @keywords-en websocket-schemas, event-schemas
 */
export const ChatStartPayloadSchema = z.object({
  message: z.string().min(1),
  chatClientId: z.string().min(1),
  sessionId: z.string().optional(),
  modelId: z.string().optional(),
  systemPrompt: z.string().optional(),
  stream: z.boolean().optional(),
  threadType: z
    .union([
      z.literal('assistant'),
      z.literal('system'),
      z.literal('todo'),
      z.literal('group'),
      z.literal('dm'),
    ])
    .optional(),
});

export const ThreadChatStartPayloadSchema = z.object({
  threadId: z.string().min(1),
  message: z.string().min(1),
  sessionId: z.string().optional(),
  modelId: z.string().optional(),
  systemPrompt: z.string().optional(),
  stream: z.boolean().optional(),
});

export const ConversationEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('token'),
    data: z.object({ text: z.string() }),
    sessionId: z.string().optional(),
  }),
  z.object({
    type: z.literal('reasoning'),
    data: z.object({ text: z.string() }),
    sessionId: z.string().optional(),
  }),
  z.object({
    type: z.literal('tool_start'),
    data: z.object({
      name: z.string(),
      input: z.any().optional(),
      id: z.string().optional(),
    }),
    sessionId: z.string().optional(),
  }),
  z.object({
    type: z.literal('tool_chunk'),
    data: z.object({
      id: z.string().optional(),
      name: z.string().optional(),
      args: z.any().optional(),
      index: z.number().optional(),
    }),
    sessionId: z.string().optional(),
  }),
  z.object({
    type: z.literal('tool_end'),
    data: z.object({
      name: z.string().optional(),
      output: z.any().optional(),
      id: z.string().optional(),
    }),
    sessionId: z.string().optional(),
  }),
  z.object({
    type: z.literal('session_group'),
    data: z.object({
      sessionGroupId: z.string(),
      date: z.string(),
      chatClientId: z.string(),
    }),
    sessionId: z.string().optional(),
  }),
  z.object({
    type: z.literal('session_group_title'),
    data: z.object({
      sessionGroupId: z.string(),
      title: z.string(),
    }),
    sessionId: z.string().optional(),
  }),
  z.object({ type: z.literal('done'), sessionId: z.string().optional() }),
  z.object({
    type: z.literal('error'),
    error: z.string(),
    sessionId: z.string().optional(),
  }),
]);
