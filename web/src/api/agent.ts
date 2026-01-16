/**
 * @title Agent API
 * @description API endpoints for the Agent module.
 * @keywords-cn 代理API, 接口定义
 * @keywords-en agent-api, endpoints
 */

import { http } from '../utils/http';
import type {
  WorkflowStep,
  Checkpoint,
  GroupListItem,
  ThreadListItem,
  GroupDetailResponse,
  CreateGroupRequest,
  CreateGroupResponse,
  UpdateGroupRequest,
  SummariesByGroupResponse,
  GroupHistoryResponse,
  CheckpointListResponse,
  Agent,
  UpdateAgentRequest,
  IdentityPrincipalItem,
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
    principalId?: string,
  ) =>
    http.get<GroupHistoryResponse>(`/conversation/groups/${groupId}/history`, {
      limit,
      includeSystem,
      principalId,
    }),

  /**
   * Send Message
   * @param content Message content
   * @param sessionId Session ID (optional)
   */
  sendMessage: (content: string, sessionId?: string) =>
    http.post<{
      sessionId: string;
      message: string;
      model: string;
      tokensUsed?: { prompt: number; completion: number; total: number };
    }>('/conversation/chat', { content, sessionId }),

  /**
   * Send Thread Message
   * @param threadId Thread ID
   * @param content Message content
   * @param sessionId Optional session ID
   */
  postThreadMessage: (
    threadId: string,
    content: string,
    sessionId?: string,
    principalId?: string,
  ) =>
    http.post<{
      sessionId: string;
      message: string;
      model: string;
      tokensUsed?: { prompt: number; completion: number; total: number };
    }>(`/conversation/threads/${threadId}/messages`, {
      content,
      sessionId,
      principalId,
    }),

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
    http.get<CheckpointListResponse>(`/conversation/checkpoints/${threadId}`, {
      limit,
    }),

  /**
   * Get Agents
   */
  getAgents: () => http.get<Agent[]>('/agent'),

  /**
   * Update Agent
   * @param id Agent ID
   * @param data Update data
   */
  updateAgent: (id: string, data: UpdateAgentRequest) =>
    http.put<Agent>(`/agent/${id}`, data),

  /**
   * Delete Agent
   * @param id Agent ID
   */
  deleteAgent: (id: string) =>
    http.delete<{ success: boolean }>(`/agent/${id}`),

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

  /**
   * Update Agent Embeddings
   * @param ids Optional list of agent IDs to update; if omitted, updates all.
   */
  updateEmbeddings: (ids?: string[]) =>
    http.post<{
      updated: number;
      errors?: Array<{ id: string; error: string }>;
    }>('/agent/embeddings', ids && ids.length ? { ids } : {}),

  /**
   * List Threads
   * @param params Filter params
   */
  listThreads: (params?: {
    type?: 'assistant' | 'system' | 'todo' | 'group' | 'dm';
    ai?: boolean;
    pinned?: boolean;
    q?: string;
    principalId?: string;
  }) => http.get<ThreadListItem[]>('/conversation/threads', params),

  /**
   * Identity: List Principals
   * @param params Query params: q/type/tenantId
   */
  listPrincipals: (params?: {
    q?: string;
    type?:
      | 'user_enterprise'
      | 'user_consumer'
      | 'official_account'
      | 'agent'
      | 'system';
    tenantId?: string;
  }) => http.get<IdentityPrincipalItem[]>('/identity/principals', params),

  /**
   * Identity: Create/Update/Delete Principal
   */
  createPrincipal: (data: {
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
  }) => http.post<IdentityPrincipalItem>('/identity/principals', data),
  updatePrincipal: (
    id: string,
    data: {
      displayName?: string;
      avatarUrl?: string | null;
      email?: string | null;
      phone?: string | null;
      active?: boolean;
    },
  ) => http.put<{ success: true }>(`/identity/principals/${id}`, data),
  deletePrincipal: (id: string) =>
    http.delete<{ success: true }>(`/identity/principals/${id}`),

  /**
   * Identity: Organizations CRUD
   */
  listOrganizations: (params?: { q?: string }) =>
    http.get<
      {
        id: string;
        name: string;
        code?: string | null;
        active: boolean;
        createdAt?: string;
        updatedAt?: string;
      }[]
    >('/identity/organizations', params),
  createOrganization: (data: { name: string; code?: string | null }) =>
    http.post<{
      id: string;
      name: string;
      code?: string | null;
      active: boolean;
    }>('/identity/organizations', data),
  updateOrganization: (
    id: string,
    data: { name?: string; code?: string | null; active?: boolean },
  ) => http.put<{ success: true }>(`/identity/organizations/${id}`, data),
  deleteOrganization: (id: string) =>
    http.delete<{ success: true }>(`/identity/organizations/${id}`),

  /**
   * Identity: Roles & Permissions
   */
  listRoles: () =>
    http.get<
      {
        id: string;
        name: string;
        code: string;
        description?: string | null;
        organizationId?: string | null;
        builtin?: boolean;
      }[]
    >('/identity/roles'),
  createRole: (data: {
    name: string;
    code: string;
    description?: string | null;
    organizationId?: string | null;
  }) =>
    http.post<{
      id: string;
      name: string;
      code: string;
      description?: string | null;
      organizationId?: string | null;
      builtin?: boolean;
    }>('/identity/roles', data),
  updateRole: (
    id: string,
    data: { name?: string; description?: string | null },
  ) => http.put<{ success: true }>(`/identity/roles/${id}`, data),
  deleteRole: (id: string) =>
    http.delete<{ success: true }>(`/identity/roles/${id}`),
  listRolePermissions: (id: string) =>
    http.get<
      {
        id: string;
        roleId: string;
        subject: string;
        action: string;
        conditions?: Record<string, unknown> | null;
      }[]
    >(`/identity/roles/${id}/permissions`),
  upsertRolePermissions: (
    id: string,
    data: {
      items: Array<{
        subject: string;
        action: string;
        conditions?: Record<string, unknown> | null;
      }>;
    },
  ) => http.put<{ success: true }>(`/identity/roles/${id}/permissions`, data),

  /**
   * Identity: Memberships
   */
  listMemberships: (params?: {
    organizationId?: string;
    principalId?: string;
  }) =>
    http.get<
      {
        id: string;
        organizationId: string;
        principalId: string;
        role: string;
        department?: string | null;
        tags?: string[] | null;
        active: boolean;
      }[]
    >('/identity/memberships', params),
  addMembership: (data: {
    organizationId: string;
    principalId: string;
    role: string;
  }) =>
    http.post<{
      id: string;
      organizationId: string;
      principalId: string;
      role: string;
      department?: string | null;
      tags?: string[] | null;
      active: boolean;
    }>('/identity/memberships', data),
  removeMembership: (id: string) =>
    http.delete<{ success: true }>(`/identity/memberships/${id}`),

  /**
   * Create Thread
   */
  createThread: (data: {
    title?: string | null;
    chatClientId?: string | null;
    threadType?: 'assistant' | 'system' | 'todo' | 'group' | 'dm';
    isPinned?: boolean;
    isAiInvolved?: boolean;
  }) => http.post<{ id: string }>('/conversation/threads', data),

  /**
   * Update Thread
   */
  updateThread: (
    threadId: string,
    data: {
      title?: string | null;
      isPinned?: boolean;
      isAiInvolved?: boolean;
      threadType?: 'assistant' | 'system' | 'todo' | 'group' | 'dm';
      active?: boolean;
      participants?: Array<{ id: string; name?: string }> | string[];
    },
  ) => http.put<{ success: true }>(`/conversation/threads/${threadId}`, data),

  /**
   * Identity: Permission Definitions
   */
  listPermissionDefinitions: () =>
    http.get<
      {
        id: string;
        subject: string;
        action: string;
        description?: string;
      }[]
    >('/identity/permissions/definitions'),
  createPermissionDefinition: (data: {
    subject: string;
    action: string;
    description?: string;
  }) => http.post<{ id: string }>('/identity/permissions/definitions', data),
  deletePermissionDefinition: (id: string) =>
    http.delete<{ success: true }>(`/identity/permissions/definitions/${id}`),
};
