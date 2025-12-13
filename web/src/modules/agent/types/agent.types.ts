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

export interface SummaryItem {
  sessionId: string;
  roundNumber: number;
  summaryContent: string;
  createdAt: string;
}

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
