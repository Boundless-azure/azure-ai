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
  Checkpoint,
  GroupListItem,
  GroupDetailResponse,
  CreateGroupRequest,
  CreateGroupResponse,
  UpdateGroupRequest,
  SummariesByGroupResponse,
  GroupHistoryResponse,
} from '../modules/agent/types/agent.types';

export const agentApi = {
  /**
   * Get Group History
   * @param groupId Group ID
   * @param limit Limit
   * @param includeSystem Include system messages
   */
  getGroupHistory: (
    groupId: string,
    limit: number = 100,
    includeSystem: boolean = true,
  ) =>
    http.get<GroupHistoryResponse>(`/conversation/groups/${groupId}/history`, {
      limit,
      includeSystem,
    }),

  /**
   * Send Message
   * @param content Message content
   * @param sessionId Session ID (optional)
   */
  sendMessage: (content: string, sessionId?: string) =>
    http.post<ChatMessage>('/conversation/chat', { content, sessionId }),

  /**
   * Get Group List
   * @param params Query parameters
   */
  getGroupList: (params?: { date?: string; dayGroupId?: string }) =>
    http.get<GroupListItem[]>('/conversation/groups', params),

  /**
   * Get Group Detail
   * @param groupId Group ID
   */
  getGroupDetail: (groupId: string) =>
    http.get<GroupDetailResponse>(`/conversation/groups/${groupId}`),

  /**
   * Create Group
   * @param data Creation data
   */
  createGroup: (data: CreateGroupRequest) =>
    http.post<CreateGroupResponse>('/conversation/groups', data),

  /**
   * Update Group
   * @param groupId Group ID
   * @param data Update data
   */
  updateGroup: (groupId: string, data: UpdateGroupRequest) =>
    http.put<{ success: true }>(`/conversation/groups/${groupId}`, data),

  /**
   * Delete Group
   * @param groupId Group ID
   */
  deleteGroup: (groupId: string) =>
    http.delete<{ success: true }>(`/conversation/groups/${groupId}`),

  /**
   * Get Group Summaries
   * @param groupId Group ID
   * @param limit Limit (default 100)
   */
  getGroupSummaries: (groupId: string, limit: number = 100) =>
    http.get<SummariesByGroupResponse>(
      `/conversation/groups/${groupId}/summaries`,
      { limit },
    ),

  /**
   * List Checkpoints
   * @param threadId Thread ID
   * @param limit Limit
   */
  listCheckpoints: (threadId: string, limit: number = 50) =>
    http.get<Checkpoint[]>(`/conversation/checkpoints/${threadId}`, { limit }),

  /**
   * Get Checkpoint Detail
   * @param threadId Thread ID
   * @param checkpointId Checkpoint ID
   */
  getCheckpointDetail: (threadId: string, checkpointId: string) =>
    http.get<Checkpoint>(
      `/conversation/checkpoints/${threadId}/${checkpointId}`,
    ),

  /**
   * Get Workflow Steps (Mock/Future)
   */
  getWorkflow: () => http.get<WorkflowStep[]>('/agent/workflow'),
};
