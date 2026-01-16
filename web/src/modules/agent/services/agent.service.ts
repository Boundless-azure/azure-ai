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
    const principalId = this.getCurrentPrincipalId();
    const response = await this.handleRequest<GroupHistoryResponse>(
      agentApi.getGroupHistory(groupId, 100, true, principalId),
    );
    const roleMap: Record<
      GroupHistoryResponse['items'][number]['role'],
      ChatRole
    > = {
      user: ChatRole.User,
      assistant: ChatRole.Assistant,
      system: ChatRole.System,
    };
    return response.items.map((item, index) => ({
      id: `${response.groupId}-${index}-${Date.now()}`,
      role: roleMap[item.role],
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
    const res = await this.handleRequest<{
      sessionId: string;
      message: string;
      model: string;
      tokensUsed?: { prompt: number; completion: number; total: number };
    }>(agentApi.sendMessage(content, sessionId));
    const now = Date.now();
    return {
      id: `${res.sessionId}-${now}`,
      role: ChatRole.Assistant,
      content: res.message,
      timestamp: now,
      tool_calls: [],
    };
  }

  /**
   * Send Thread Message
   * @description Sends a message to a specific conversation thread.
   * @keywords-cn 线程发送消息
   * @keywords-en send-thread-message
   */
  public async sendThreadMessage(
    threadId: string,
    content: string,
    sessionId?: string,
  ): Promise<ChatMessage> {
    const principalId = this.getCurrentPrincipalId();
    const res = await this.handleRequest<{
      sessionId: string;
      message: string;
      model: string;
      tokensUsed?: { prompt: number; completion: number; total: number };
    }>(agentApi.postThreadMessage(threadId, content, sessionId, principalId));
    const now = Date.now();
    return {
      id: `${res.sessionId}-${now}`,
      role: ChatRole.Assistant,
      content: res.message,
      timestamp: now,
      tool_calls: [],
    };
  }

  /**
   * List Threads
   * @description Retrieves conversation threads with filters.
   * @keywords-cn 获取线程列表, 微信式
   * @keywords-en list-threads, chat-style
   */
  public async getThreadList(params?: {
    type?: 'assistant' | 'system' | 'todo' | 'group' | 'dm';
    ai?: boolean;
    pinned?: boolean;
    q?: string;
  }): Promise<import('../types/agent.types').ThreadListItem[]> {
    const principalId = this.getCurrentPrincipalId();
    const merged = principalId ? { ...(params || {}), principalId } : params;
    return this.handleRequest(agentApi.listThreads(merged));
  }

  /**
   * Create Thread
   * @description Creates a new conversation thread.
   * @keywords-cn 创建线程
   * @keywords-en create-thread
   */
  public async createThread(data: {
    title?: string | null;
    chatClientId?: string | null;
    threadType?: 'assistant' | 'system' | 'todo' | 'group' | 'dm';
    isPinned?: boolean;
    isAiInvolved?: boolean;
  }): Promise<{ id: string }> {
    return this.handleRequest(agentApi.createThread(data));
  }

  /**
   * Update Thread
   * @description Updates an existing conversation thread.
   * @keywords-cn 更新线程
   * @keywords-en update-thread
   */
  public async updateThread(
    threadId: string,
    data: {
      title?: string | null;
      isPinned?: boolean;
      isAiInvolved?: boolean;
      threadType?: 'assistant' | 'system' | 'todo' | 'group' | 'dm';
      active?: boolean;
      participants?: Array<{ id: string; name?: string }> | string[];
    },
  ): Promise<{ success: true }> {
    return this.handleRequest(agentApi.updateThread(threadId, data));
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

  /**
   * @title 更新Agent向量
   * @description 调用后端接口，根据传入ID列表或全量更新embedding。
   * @keywords-cn 向量更新, 全量, 选择
   * @keywords-en embeddings-update, all, selected
   */
  public async updateEmbeddings(ids?: string[]): Promise<{ updated: number }> {
    const ui = useUIStore();
    try {
      const res = await agentApi.updateEmbeddings(ids);
      const data = this.isBaseResponse(res) ? res.data : res;
      const updated = (data as { updated: number }).updated ?? 0;
      ui.showToast(`Embeddings updated: ${updated}`, 'success');
      return { updated };
    } catch (error: any) {
      const msg =
        error instanceof Error ? error.message : 'Update embeddings failed';
      ui.showToast(msg, 'error');
      throw error;
    }
  }

  /**
   * List Contacts (Principals)
   * @description 获取统一主体作为通讯录项，并映射为 ThreadListItem（dm）。
   * @keywords-cn 通讯录, 主体, 私聊
   * @keywords-en contacts, principal, dm
   */
  public async getContacts(params?: {
    q?: string;
    type?:
      | 'user_enterprise'
      | 'user_consumer'
      | 'official_account'
      | 'agent'
      | 'system';
    tenantId?: string;
  }): Promise<import('../types/agent.types').ThreadListItem[]> {
    const list = await this.handleRequest<
      import('../types/agent.types').IdentityPrincipalItem[]
    >(agentApi.listPrincipals(params));
    const nowIso = new Date().toISOString();
    return list.map((p) => ({
      id: `contact:${p.id}`,
      title: p.displayName,
      chatClientId: null,
      threadType: 'dm',
      isPinned: false,
      isAiInvolved: false,
      members: undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    }));
  }

  /**
   * Start DM Thread for Principal
   * @description 为联系人创建私聊线程并设置参与者。
   * @keywords-cn 创建私聊, 参与者
   * @keywords-en create-dm, participants
   */
  public async startDmForPrincipal(principal: {
    id: string;
    displayName: string;
  }): Promise<{ id: string }> {
    const created = await this.handleRequest<{ id: string }>(
      agentApi.createThread({ threadType: 'dm', isAiInvolved: false }),
    );
    await this.handleRequest(
      agentApi.updateThread(created.id, {
        participants: [{ id: principal.id, name: principal.displayName }],
      }),
    );
    return created;
  }

  /** Read current principal id from local storage for permission-aware queries */
  private getCurrentPrincipalId(): string | undefined {
    try {
      const raw = localStorage.getItem('identity.currentPrincipalId');
      const id = (raw || '').trim();
      return id || undefined;
    } catch {
      return undefined;
    }
  }
}

export const agentService = new AgentService();
