/**
 * @title Agent API
 * @description API endpoints for the Agent module.
 * @keywords-cn 代理API, 接口定义
 * @keywords-en agent-api, endpoints
 */

import { http } from '../utils/http';
import { z } from 'zod';
import {
  QueryPrincipalSchema,
  QueryUsersSchema,
} from '../modules/identity/types/identity.types';
import {
  SendMessageSchema,
  PostThreadMessageSchema,
  GetGroupHistoryParamsSchema,
  GetGroupListParamsSchema,
  CreateGroupRequestSchema,
  UpdateGroupRequestSchema,
  UpdateAgentRequestSchema,
  ListThreadsParamsSchema,
  UpdateEmbeddingsSchema,
} from '../modules/agent/types/agent.types';
import {
  CreatePrincipalSchema,
  UpdatePrincipalSchema,
  CreateUserSchema,
  UpdateUserSchema,
  QueryOrganizationSchema,
  CreateOrganizationSchema,
  UpdateOrganizationSchema,
  CreateRoleSchema,
  UpdateRoleSchema,
  UpsertRolePermissionsSchema,
  ListMembershipsQuerySchema,
  AddMembershipSchema,
  CreatePermissionDefinitionSchema,
} from '../modules/identity/types/identity.types';
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
  GroupListQueryDto,
  SessionHistoryResponse,
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
    since?: string,
  ) => {
    const parsed = GetGroupHistoryParamsSchema.safeParse({
      limit,
      includeSystem,
      principalId,
      since,
    });
    if (!parsed.success) throw new Error('Invalid group history params');
    return http.get<GroupHistoryResponse>(
      `/conversation/groups/${groupId}/history`,
      parsed.data,
    );
  },

  /**
   * Send Message
   * @param content Message content
   * @param sessionId Session ID (optional)
   */
  sendMessage: (content: string, sessionId?: string) => {
    const parsed = SendMessageSchema.safeParse({ content, sessionId });
    if (!parsed.success) throw new Error('Invalid send message payload');
    return http.post<{
      sessionId: string;
      message: string;
      model: string;
      tokensUsed?: { prompt: number; completion: number; total: number };
    }>('/conversation/chat', parsed.data);
  },

  /**
   * Get Session History
   * @param sessionId Session ID
   * @param limit Limit
   * @keywords-cn 会话历史, 历史消息
   * @keywords-en session-history, history-messages
   */
  getSessionHistory: (sessionId: string, limit: number = 100) => {
    const parsed = z
      .object({ limit: z.number().int().min(1).max(2000).optional() })
      .safeParse({ limit });
    if (!parsed.success) throw new Error('Invalid session history params');
    return http.get<SessionHistoryResponse>(
      `/conversation/sessions/${sessionId}/history`,
      parsed.data,
    );
  },

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
  ) => {
    const parsed = PostThreadMessageSchema.safeParse({
      content,
      sessionId,
      principalId,
    });
    if (!parsed.success) throw new Error('Invalid thread message payload');
    return http.post<{
      sessionId: string;
      message: string;
      model: string;
      tokensUsed?: { prompt: number; completion: number; total: number };
    }>(`/conversation/threads/${threadId}/messages`, parsed.data);
  },

  /**
   * Get Group List
   * @param params Query parameters
   */
  getGroupList: (params?: GroupListQueryDto) => {
    const parsed = params
      ? GetGroupListParamsSchema.safeParse(params)
      : { success: true, data: {} };
    if (!parsed.success) throw new Error('Invalid group list params');
    return http.get<GroupListItem[]>('/conversation/groups', parsed.data);
  },

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
  createGroup: (data: CreateGroupRequest) => {
    const parsed = CreateGroupRequestSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid create group payload');
    return http.post<CreateGroupResponse>('/conversation/groups', parsed.data);
  },

  /**
   * Update Group
   * @param groupId Group ID
   * @param data Update data
   */
  updateGroup: (groupId: string, data: UpdateGroupRequest) => {
    const parsed = UpdateGroupRequestSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid update group payload');
    return http.put<{ success: true }>(
      `/conversation/groups/${groupId}`,
      parsed.data,
    );
  },

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
  listCheckpoints: (threadId: string, limit: number = 50) => {
    const parsed = z
      .object({ limit: z.number().int().min(1).max(2000).optional() })
      .safeParse({ limit });
    if (!parsed.success) throw new Error('Invalid checkpoint params');
    return http.get<CheckpointListResponse>(
      `/conversation/checkpoints/${threadId}`,
      parsed.data,
    );
  },

  /**
   * Get Agents
   */
  getAgents: () => http.get<Agent[]>('/agent'),

  /**
   * Update Agent
   * @param id Agent ID
   * @param data Update data
   */
  updateAgent: (id: string, data: UpdateAgentRequest) => {
    const parsed = UpdateAgentRequestSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid update agent payload');
    return http.put<Agent>(`/agent/${id}`, parsed.data);
  },

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
  updateEmbeddings: (ids?: string[]) => {
    const parsed = UpdateEmbeddingsSchema.safeParse({ ids });
    if (!parsed.success) throw new Error('Invalid embeddings payload');
    return http.post<{
      updated: number;
      errors?: Array<{ id: string; error: string }>;
    }>(
      '/agent/embeddings',
      parsed.data.ids && parsed.data.ids.length ? { ids: parsed.data.ids } : {},
    );
  },

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
  }) => {
    const parsed = params
      ? ListThreadsParamsSchema.safeParse(params)
      : { success: true, data: {} };
    if (!parsed.success) throw new Error('Invalid threads params');
    return http.get<ThreadListItem[]>('/conversation/threads', parsed.data);
  },

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
  }) => {
    const parsed = params
      ? QueryPrincipalSchema.safeParse(params)
      : { success: true, data: {} };
    if (!parsed.success) {
      throw new Error('Invalid principal query params');
    }
    return http.get<IdentityPrincipalItem[]>(
      '/identity/principals',
      parsed.data,
    );
  },

  /**
   * Identity: List Users Only
   * @param params Query params: q/type(user_enterprise|user_consumer)/tenantId
   * @keywords-cn 用户列表, 企业用户, 消费者
   * @keywords-en list-users, enterprise-user, consumer
   */
  listUsers: (params?: {
    q?: string;
    tenantId?: string;
    type?: 'user_enterprise' | 'user_consumer' | 'system';
  }) => {
    const parsed = params
      ? QueryUsersSchema.safeParse(params)
      : { success: true, data: {} };
    if (!parsed.success) {
      throw new Error('Invalid users query params');
    }
    return http.get<IdentityPrincipalItem[]>('/identity/users', parsed.data);
  },

  createUser: (data: {
    displayName: string;
    principalType: 'user_enterprise' | 'user_consumer' | 'system';
    email: string;
    password?: string;
    phone?: string | null;
    tenantId?: string | null;
  }) => {
    const parsed = CreateUserSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid create user payload');
    return http.post<IdentityPrincipalItem>('/identity/users', parsed.data);
  },
  updateUser: (
    id: string,
    data: {
      displayName?: string;
      email?: string;
      phone?: string | null;
      active?: boolean;
    },
  ) => {
    const parsed = UpdateUserSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid update user payload');
    return http.put<{ success: true }>(`/identity/users/${id}`, parsed.data);
  },
  deleteUser: (id: string) =>
    http.delete<{ success: true }>(`/identity/users/${id}`),

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
  }) => {
    const parsed = CreatePrincipalSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid create principal payload');
    return http.post<IdentityPrincipalItem>(
      '/identity/principals',
      parsed.data,
    );
  },
  updatePrincipal: (
    id: string,
    data: {
      displayName?: string;
      avatarUrl?: string | null;
      email?: string | null;
      phone?: string | null;
      active?: boolean;
    },
  ) => {
    const parsed = UpdatePrincipalSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid update principal payload');
    return http.put<{ success: true }>(
      `/identity/principals/${id}`,
      parsed.data,
    );
  },
  deletePrincipal: (id: string) =>
    http.delete<{ success: true }>(`/identity/principals/${id}`),

  /**
   * Identity: Organizations CRUD
   */
  listOrganizations: (params?: { q?: string }) => {
    const parsed = params
      ? QueryOrganizationSchema.safeParse(params)
      : { success: true, data: {} };
    if (!parsed.success) throw new Error('Invalid organization query');
    return http.get<
      {
        id: string;
        name: string;
        code?: string | null;
        active: boolean;
        createdAt?: string;
        updatedAt?: string;
      }[]
    >('/identity/organizations', parsed.data);
  },
  createOrganization: (data: { name: string; code?: string | null }) => {
    const parsed = CreateOrganizationSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid create organization payload');
    return http.post<{
      id: string;
      name: string;
      code?: string | null;
      active: boolean;
    }>('/identity/organizations', parsed.data);
  },
  updateOrganization: (
    id: string,
    data: { name?: string; code?: string | null; active?: boolean },
  ) => {
    const parsed = UpdateOrganizationSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid update organization payload');
    return http.put<{ success: true }>(
      `/identity/organizations/${id}`,
      parsed.data,
    );
  },
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
  }) => {
    const parsed = CreateRoleSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid create role payload');
    return http.post<{
      id: string;
      name: string;
      code: string;
      description?: string | null;
      organizationId?: string | null;
      builtin?: boolean;
    }>('/identity/roles', parsed.data);
  },
  updateRole: (
    id: string,
    data: { name?: string; description?: string | null },
  ) => {
    const parsed = UpdateRoleSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid update role payload');
    return http.put<{ success: true }>(`/identity/roles/${id}`, parsed.data);
  },
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
  ) => {
    const parsed = UpsertRolePermissionsSchema.safeParse(data);
    if (!parsed.success)
      throw new Error('Invalid upsert role permissions payload');
    return http.put<{ success: true }>(
      `/identity/roles/${id}/permissions`,
      parsed.data,
    );
  },

  /**
   * Identity: Memberships
   */
  listMemberships: (params?: {
    organizationId?: string;
    principalId?: string;
  }) => {
    const parsed = params
      ? ListMembershipsQuerySchema.safeParse(params)
      : { success: true, data: {} };
    if (!parsed.success) throw new Error('Invalid membership query');
    return http.get<
      {
        id: string;
        organizationId: string;
        principalId: string;
        role: string;
        department?: string | null;
        tags?: string[] | null;
        active: boolean;
      }[]
    >('/identity/memberships', parsed.data);
  },
  addMembership: (data: {
    organizationId: string;
    principalId: string;
    role: string;
  }) => {
    const parsed = AddMembershipSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid add membership payload');
    return http.post<{
      id: string;
      organizationId: string;
      principalId: string;
      role: string;
      department?: string | null;
      tags?: string[] | null;
      active: boolean;
    }>('/identity/memberships', parsed.data);
  },
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
  }) => {
    const parsed = z
      .object({
        title: z.string().nullable().optional(),
        chatClientId: z.string().nullable().optional(),
        threadType: z
          .union([
            z.literal('assistant'),
            z.literal('system'),
            z.literal('todo'),
            z.literal('group'),
            z.literal('dm'),
          ])
          .optional(),
        isPinned: z.boolean().optional(),
        isAiInvolved: z.boolean().optional(),
      })
      .safeParse(data);
    if (!parsed.success) throw new Error('Invalid create thread payload');
    return http.post<{ id: string }>('/conversation/threads', parsed.data);
  },

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
  ) => {
    const parsed = z
      .object({
        title: z.string().nullable().optional(),
        isPinned: z.boolean().optional(),
        isAiInvolved: z.boolean().optional(),
        threadType: z
          .union([
            z.literal('assistant'),
            z.literal('system'),
            z.literal('todo'),
            z.literal('group'),
            z.literal('dm'),
          ])
          .optional(),
        active: z.boolean().optional(),
        participants: z
          .array(z.object({ id: z.string(), name: z.string().optional() }))
          .or(z.array(z.string()))
          .optional(),
      })
      .safeParse(data);
    if (!parsed.success) throw new Error('Invalid update thread payload');
    return http.put<{ success: true }>(
      `/conversation/threads/${threadId}`,
      parsed.data,
    );
  },

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
  }) => {
    const parsed = CreatePermissionDefinitionSchema.safeParse(data);
    if (!parsed.success)
      throw new Error('Invalid create permission definition payload');
    return http.post<{ id: string }>(
      '/identity/permissions/definitions',
      parsed.data,
    );
  },
  deletePermissionDefinition: (id: string) =>
    http.delete<{ success: true }>(`/identity/permissions/definitions/${id}`),
};
