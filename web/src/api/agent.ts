/**
 * @title Agent API
 * @description API endpoints for the Agent module.
 * @keywords-cn 代理API, 接口定义
 * @keywords-en agent-api, endpoints
 */

import { http } from '../utils/http';
import type {
  ChatMessage,
  WorkflowStep,
} from '../modules/agent/types/agent.types';

export const agentApi = {
  /**
   * Get Chat History
   * @param date Date string (YYYY-MM-DD)
   */
  getHistory: (date: string) =>
    http.get<Record<string, ChatMessage[]>>('/agent/history', { date }),

  /**
   * Get Workflow Steps
   */
  getWorkflow: () => http.get<WorkflowStep[]>('/agent/workflow'),

  /**
   * Send Message
   * @param content Message content
   */
  sendMessage: (content: string) =>
    http.post<ChatMessage>('/agent/chat', { content }),
};
