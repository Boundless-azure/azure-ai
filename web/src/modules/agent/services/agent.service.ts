/**
 * @title Agent Service
 * @description Service for handling agent logic, chat history, and workflow state.
 * @keywords-cn 代理服务, 聊天历史, 工作流管理
 * @keywords-en agent-service, chat-history, workflow-management
 */

import type {
  ChatMessage,
  WorkflowStep,
  QuickItem,
} from '../types/agent.types';

export class AgentService {
  /**
   * Get Function Call Description
   * @description Returns the function call description for this service.
   */
  public getHandle() {
    return {
      name: 'agent_service',
      description: 'Service for managing AI agent interactions and state.',
      parameters: {},
    };
  }

  /**
   * Get Chat History
   * @description Retrieves chat history grouped by day (mock implementation).
   */
  public getChatHistory(): Record<string, ChatMessage[]> {
    // Mock data
    const today = new Date().toLocaleDateString();
    return {
      [today]: [
        {
          id: '1',
          role: 'assistant',
          content: 'Hello! How can I help you today?',
          timestamp: Date.now(),
        },
      ],
    };
  }

  /**
   * Get Workflow Steps
   * @description Retrieves current workflow steps.
   */
  public getWorkflowSteps(): WorkflowStep[] {
    return [
      { id: '1', title: 'Initialization', status: 'completed' },
      { id: '2', title: 'Data Processing', status: 'active' },
      { id: '3', title: 'Finalization', status: 'pending' },
    ];
  }

  /**
   * Get Quick Items
   * @description Retrieves items for the quick panel.
   */
  public getQuickItems(): QuickItem[] {
    return [
      { id: '1', title: 'Check Email', icon: 'envelope', type: 'todo' },
      { id: '2', title: 'System Update', icon: 'bell', type: 'notification' },
      { id: '3', title: 'Knowledge Base', icon: 'book', type: 'resource' },
      { id: '4', title: 'API Docs', icon: 'code', type: 'resource' },
    ];
  }
}

export const agentService = new AgentService();
