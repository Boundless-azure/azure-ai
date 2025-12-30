/**
 * @title Agent Service
 * @description Service for handling agent logic, chat history, and workflow state.
 * @keywords-cn 代理服务, 聊天历史, 工作流管理
 * @keywords-en agent-service, chat-history, workflow-management
 */

import {
  WorkflowStepStatus,
  QuickItemType,
  ChatRole,
  WorkflowGraphStatus,
} from '../enums/agent.enums';
import type {
  ChatMessage,
  WorkflowStep,
  QuickItem,
  Checkpoint,
  GroupListItem,
  SummariesByGroupResponse,
  GroupHistoryResponse,
  CreateGroupRequest,
  CreateGroupResponse,
  Agent,
  UpdateAgentRequest,
  CheckpointListResponse,
  ActiveWorkflowCard,
} from '../types/agent.types';
import type { BaseResponse } from '../../../utils/types';
import { useUIStore } from '../store/ui.store';
import { agentApi } from '../../../api/agent';

export class AgentService {
  /**
   * Private helper for handling API requests with error feedback
   */
  private async handleRequest<T>(request: Promise<unknown>): Promise<T> {
    try {
      const response = await request;
      // Handle BaseResponse structure if present
      if (this.isBaseResponse<T>(response)) {
        return response.data;
      }
      return response as T;
    } catch (error: any) {
      const uiStore = useUIStore();
      const errorMessage =
        error instanceof Error ? error.message : 'Network error occurred';
      uiStore.showToast(errorMessage, 'error');
      throw error;
    }
  }

  /**
   * Type guard for BaseResponse
   */
  private isBaseResponse<T>(response: unknown): response is BaseResponse<T> {
    return (
      typeof response === 'object' &&
      response !== null &&
      'data' in response &&
      'code' in response
    );
  }

  /**
   * Get Function Call Description
   * @description Returns the function call description for this service.
   * @keywords-cn 获取句柄, 功能描述
   * @keywords-en get-handle, function-description
   */
  public getHandle() {
    return {
      name: 'agent_service',
      description: 'Service for managing AI agent interactions and state.',
      parameters: {},
    };
  }

  /**
   * Get Agents
   */
  public async getAgents(): Promise<Agent[]> {
    return this.handleRequest<Agent[]>(agentApi.getAgents());
  }

  /**
   * Update Agent
   */
  public async updateAgent(
    id: string,
    data: UpdateAgentRequest,
  ): Promise<Agent> {
    return this.handleRequest<Agent>(agentApi.updateAgent(id, data));
  }

  /**
   * Delete Agent
   */
  public async deleteAgent(id: string): Promise<{ success: boolean }> {
    return this.handleRequest<{ success: boolean }>(agentApi.deleteAgent(id));
  }

  /**
   * Get Group History
   * @description Retrieves history for a specific group.
   * @keywords-cn 获取分组历史
   * @keywords-en get-group-history
   */
  public async getGroupHistory(groupId: string): Promise<ChatMessage[]> {
    const response = await this.handleRequest<GroupHistoryResponse>(
      agentApi.getGroupHistory(groupId),
    );
    return response.items.map((item, index) => ({
      id: `${response.groupId}-${index}-${Date.now()}`,
      role: item.role as ChatRole,
      content: item.content,
      timestamp: new Date(item.timestamp).getTime(),
      tool_calls: [],
    }));
  }

  /**
   * Send Message
   * @description Sends a message to the agent.
   * @keywords-cn 发送消息
   * @keywords-en send-message
   */
  public async sendMessage(
    content: string,
    sessionId?: string,
  ): Promise<ChatMessage> {
    return this.handleRequest<ChatMessage>(
      agentApi.sendMessage(content, sessionId),
    );
  }

  /**
   * Get Workflow Steps
   * @description Retrieves current workflow steps.
   * @keywords-cn 获取工作流步骤
   * @keywords-en get-workflow-steps
   */
  public getWorkflowSteps(): WorkflowStep[] {
    return [
      {
        id: '1',
        title: 'Initialization',
        status: WorkflowStepStatus.Completed,
      },
      { id: '2', title: 'Data Processing', status: WorkflowStepStatus.Active },
      { id: '3', title: 'Finalization', status: WorkflowStepStatus.Pending },
    ];
  }

  /**
   * Get Quick Items
   * @description Retrieves items for the quick panel.
   * @keywords-cn 获取快捷项
   * @keywords-en get-quick-items
   */
  public getQuickItems(): QuickItem[] {
    return [
      {
        id: '1',
        title: 'Check Email',
        icon: 'envelope',
        type: QuickItemType.Todo,
      },
      {
        id: '2',
        title: 'System Update',
        icon: 'bell',
        type: QuickItemType.Notification,
      },
      {
        id: '3',
        title: 'Knowledge Base',
        icon: 'book',
        type: QuickItemType.Resource,
      },
      {
        id: '4',
        title: 'API Docs',
        icon: 'code',
        type: QuickItemType.Resource,
      },
    ];
  }

  /**
   * Create Group
   * @description Creates a new conversation group.
   * @keywords-cn 创建对话组
   * @keywords-en create-group
   */
  public async createGroup(
    data: CreateGroupRequest,
  ): Promise<CreateGroupResponse> {
    return this.handleRequest<CreateGroupResponse>(agentApi.createGroup(data));
  }

  /**
   * Delete Group
   * @description Deletes a conversation group.
   * @keywords-cn 删除对话组
   * @keywords-en delete-group
   */
  public async deleteGroup(groupId: string): Promise<void> {
    await this.handleRequest(agentApi.deleteGroup(groupId));
  }

  /**
   * Get Group List
   * @description Retrieves list of conversation groups.
   * @keywords-cn 获取对话组列表
   * @keywords-en get-group-list
   */
  public async getGroupList(params?: {
    date?: string;
    dayGroupId?: string;
  }): Promise<GroupListItem[]> {
    return this.handleRequest<GroupListItem[]>(agentApi.getGroupList(params));
  }

  /**
   * Get Group Summaries
   * @description Retrieves summaries for a group.
   * @keywords-cn 获取对话组摘要
   * @keywords-en get-group-summaries
   */
  public async getGroupSummaries(
    groupId: string,
  ): Promise<SummariesByGroupResponse> {
    return this.handleRequest<SummariesByGroupResponse>(
      agentApi.getGroupSummaries(groupId),
    );
  }

  /**
   * List Checkpoints
   * @description Retrieves checkpoints for a thread.
   * @keywords-cn 列出检查点
   * @keywords-en list-checkpoints
   */
  public async listCheckpoints(threadId: string, limit = 50) {
    return this.handleRequest<CheckpointListResponse>(
      agentApi.listCheckpoints(threadId, limit),
    );
  }

  /**
   * Get Checkpoint Detail
   * @description Retrieves checkpoint detail.
   * @keywords-cn 获取检查点详情
   * @keywords-en get-checkpoint-detail
   */
  public async getCheckpointDetail(threadId: string, checkpointId: string) {
    return this.handleRequest<Checkpoint>(
      agentApi.getCheckpointDetail(threadId, checkpointId),
    );
  }

  /**
   * Get Active Workflows
   * @description Lists active conversation groups for a date and maps last checkpoint to card info.
   * @keywords-cn 获取进行中的工作流, 活跃分组, 检查点映射
   * @keywords-en get-active-workflows, active-groups, checkpoint-mapping
   */
  public async getActiveWorkflows(date: string): Promise<ActiveWorkflowCard[]> {
    const groups = await this.handleRequest<GroupListItem[]>(
      agentApi.getGroupList({ date }),
    );
    const now = Date.now();
    const thresholdMs = 90 * 1000; // 90 seconds window to consider "running"
    const candidates = await Promise.all(
      groups.map(async (g) => {
        let latestTs: number | null = null;
        try {
          const cps = await this.handleRequest<CheckpointListResponse>(
            agentApi.listCheckpoints(g.id, 1),
          );
          const latest = cps.items?.[0];
          if (latest?.ts) {
            latestTs = new Date(latest.ts).getTime();
          }
        } catch (_) {
          latestTs = null;
        }
        const isRecent = latestTs !== null && now - latestTs <= thresholdMs;
        const status =
          isRecent && g.active
            ? WorkflowGraphStatus.Running
            : WorkflowGraphStatus.Completed;
        return {
          id: g.id,
          name: g.title ?? g.dayGroupId,
          node: latestTs ? new Date(latestTs).toLocaleString() : '—',
          status,
        } as ActiveWorkflowCard;
      }),
    );
    return candidates.filter((c) => c.status === WorkflowGraphStatus.Running);
  }
}

export const agentService = new AgentService();
