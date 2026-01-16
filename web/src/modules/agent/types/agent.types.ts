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
}

export interface ThreadListItem {
  id: string;
  title: string | null;
  chatClientId: string | null;
  threadType: 'assistant' | 'system' | 'todo' | 'group' | 'dm';
  isPinned: boolean;
  isAiInvolved: boolean;
  workflowStatus?: 'running' | 'idle' | 'error' | 'completed';
  lastMessage?: string;
  members?: string[]; // Array of avatar URLs or names/initials
  createdAt: string;
  updatedAt: string;
}

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

export interface SummariesByGroupResponse {
  groupId: string;
  report: DailyReportContent;
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
