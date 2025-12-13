/**
 * @title Agent Entities
 * @description Entities for the Agent module.
 * @keywords-cn 代理实体
 * @keywords-en agent-entities
 */

import { ChatRole, ToolCallStatus } from '../enums/agent.enums';
import type { ChatMessage, ToolCall } from '../types/agent.types';

export class ChatMessageEntity implements ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  tool_calls?: ToolCall[];

  constructor(data: ChatMessage) {
    this.id = data.id;
    this.role = data.role;
    this.content = data.content;
    this.timestamp = data.timestamp;
    this.tool_calls = data.tool_calls;
  }
}
