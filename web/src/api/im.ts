/**
 * @title IM API
 * @description REST API for IM sessions and messages.
 * @keywords-cn IM接口, 会话, 消息
 * @keywords-en im-api, session, message
 */

import { http } from '../utils/http';
import { z } from 'zod';

// ========== Types ==========

export type ChatSessionType = 'private' | 'group' | 'channel';
export type ChatMessageType = 'text' | 'image' | 'file' | 'system';
export type ChatMemberRole = 'owner' | 'admin' | 'member';

export interface ImCursorResult<TItem> {
  items: TItem[];
  cursor: string | null;
}

export interface ImSessionSummary {
  id: string;
  sessionId: string;
  name: string | null;
  type: ChatSessionType;
  avatarUrl: string | null;
  members: ImMemberInfo[];
  lastMessageId?: string | null;
  memberLastMessageId?: string | null;
  lastMessage?: ImMessageInfo | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount?: number;
  createdAt: string;
}

export type ImSessionListResponse = ImCursorResult<ImSessionSummary>;

export interface ImMemberInfo {
  principalId: string;
  displayName: string;
  role: ChatMemberRole;
  joinedAt: string | null;
  lastReadAt: string | null;
  avatarUrl?: string | null;
}

export interface ImSessionDetail extends ImSessionSummary {
  description: string | null;
  creatorId: string | null;
  members: ImMemberInfo[];
}

export interface ImMessageInfo {
  id: string;
  sessionId: string;
  senderId: string | null;
  senderName?: string;
  messageType: ChatMessageType;
  content: string;
  replyToId: string | null;
  attachments: Array<{
    type: string;
    url: string;
    name?: string;
    size?: number;
  }> | null;
  isEdited: boolean;
  createdAt: string;
}

export type ImMessageListResponse = ImCursorResult<ImMessageInfo>;

// ========== Schemas ==========

const CreateSessionSchema = z.object({
  type: z.enum(['private', 'group', 'channel']),
  name: z.string().optional(),
  description: z.string().optional(),
  avatarUrl: z.string().optional(),
  memberIds: z.array(z.string().min(1)).optional(),
});

const SendMessageSchema = z.object({
  content: z.string().min(1),
  messageType: z.enum(['text', 'image', 'file', 'system']).optional(),
  replyToId: z.string().uuid().optional(),
  attachments: z
    .array(
      z.object({
        type: z.string(),
        url: z.string(),
        name: z.string().optional(),
        size: z.number().optional(),
      }),
    )
    .optional(),
});

const GetMessagesSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  last_message_id: z.string().uuid().optional(),
  before: z.string().uuid().optional(),
  after: z.string().uuid().optional(),
});

const GetSessionsSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  last_message_id: z.string().uuid().optional(),
});

const AddMemberSchema = z.object({
  principalId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'member']).optional(),
});

// ========== API ==========

export const imApi = {
  /**
   * Create a new IM session
   */
  createSession: (data: z.infer<typeof CreateSessionSchema>) => {
    const parsed = CreateSessionSchema.safeParse(data);
    if (!parsed.success) {
      console.error('Invalid create session payload:', parsed.error);
      throw new Error('Invalid create session payload');
    }
    return http.post<ImSessionDetail>('/im/sessions', parsed.data);
  },

  /**
   * Update session (rename, etc.)
   */
  updateSession: (
    sessionId: string,
    data: { name?: string; isPinned?: boolean },
  ) => {
    // Note: Assuming backend supports PATCH or PUT for session update
    // If not, we might need to adjust or create a separate endpoint.
    // For now, using a hypothetical endpoint.
    return http.patch<ImSessionDetail>(`/im/sessions/${sessionId}`, data);
  },

  /**
   * Get list of sessions for current user
   */
  getSessions: (params?: z.infer<typeof GetSessionsSchema>) => {
    const parsed = params
      ? GetSessionsSchema.safeParse(params)
      : { success: true, data: {} };
    if (!parsed.success) throw new Error('Invalid get sessions params');
    return http.get<ImSessionListResponse>('/im/sessions', parsed.data);
  },

  /**
   * Get session detail
   */
  getSession: (sessionId: string) => {
    return http.get<ImSessionDetail>(`/im/sessions/${sessionId}`);
  },

  /**
   * Delete a session
   */
  deleteSession: (sessionId: string) => {
    return http.delete<{ success: boolean }>(`/im/sessions/${sessionId}`);
  },

  /**
   * Get session members
   */
  getMembers: (sessionId: string) => {
    return http.get<ImMemberInfo[]>(`/im/sessions/${sessionId}/members`);
  },

  /**
   * Add member to session
   */
  addMember: (sessionId: string, data: z.infer<typeof AddMemberSchema>) => {
    const parsed = AddMemberSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid add member payload');
    return http.post<ImMemberInfo>(
      `/im/sessions/${sessionId}/members`,
      parsed.data,
    );
  },

  /**
   * Remove member from session
   */
  removeMember: (sessionId: string, principalId: string) => {
    return http.delete<{ success: boolean }>(
      `/im/sessions/${sessionId}/members/${principalId}`,
    );
  },

  /**
   * Get message history
   */
  getMessages: (
    sessionId: string,
    params?: z.infer<typeof GetMessagesSchema>,
  ) => {
    const parsed = params
      ? GetMessagesSchema.safeParse(params)
      : { success: true, data: {} };
    if (!parsed.success) throw new Error('Invalid get messages params');
    return http.get<ImMessageListResponse>(
      `/im/sessions/${sessionId}/messages`,
      parsed.data,
    );
  },

  /**
   * Check if there are new messages since a given time
   */
  hasNew: (sessionId: string, sinceIso: string) => {
    return http.get<{
      hasNew: boolean;
      count?: number;
      lastMessageAt?: string;
    }>(`/im/sessions/${sessionId}/messages/has-new`, { since: sinceIso });
  },

  /**
   * Send message to session
   */
  sendMessage: (sessionId: string, data: z.infer<typeof SendMessageSchema>) => {
    const parsed = SendMessageSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid send message payload');
    return http.post<ImMessageInfo>(
      `/im/sessions/${sessionId}/messages`,
      parsed.data,
    );
  },
};
