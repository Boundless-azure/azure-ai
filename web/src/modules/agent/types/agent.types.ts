/**
 * @title Agent Types
 * @description Definitions for Agent module types.
 * @keywords-cn 代理类型, 聊天消息, 工作流状态
 * @keywords-en agent-types, chat-message, workflow-status
 */

export interface ToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string
  status: 'calling' | 'completed' | 'failed';
  result?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tool_calls?: ToolCall[];
}

export interface WorkflowStep {
  id: string;
  title: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

export interface QuickItem {
  id: string;
  title: string;
  icon: string;
  type: 'resource' | 'todo' | 'notification';
}

export interface ChatSegment {
  id: string;
  name: string;
  startIndex: number; // Index in the daily message array
  endIndex: number; // Index in the daily message array (exclusive or inclusive? Let's say inclusive for now)
  isVisible: boolean;
}
