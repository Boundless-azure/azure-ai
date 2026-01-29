/**
 * @title IM Types
 * @description TypeScript types for IM module frontend.
 * @keywords-cn IM类型, 消息, 会话
 * @keywords-en im-types, message, session
 */

import { z } from 'zod';

// ========== Enums ==========

export const ChatSessionType = {
  Private: 'private',
  Group: 'group',
  Channel: 'channel',
} as const;
export type ChatSessionType =
  (typeof ChatSessionType)[keyof typeof ChatSessionType];

export const ChatMessageType = {
  Text: 'text',
  Image: 'image',
  File: 'file',
  System: 'system',
} as const;
export type ChatMessageType =
  (typeof ChatMessageType)[keyof typeof ChatMessageType];

export const ChatMemberRole = {
  Owner: 'owner',
  Admin: 'admin',
  Member: 'member',
} as const;
export type ChatMemberRole =
  (typeof ChatMemberRole)[keyof typeof ChatMemberRole];

// ========== Schemas ==========

export const ImMemberInfoSchema = z.object({
  principalId: z.string(),
  displayName: z.string(),
  role: z.enum(['owner', 'admin', 'member']),
  joinedAt: z.string().nullable(),
  lastReadAt: z.string().nullable(),
});
export type ImMemberInfo = z.infer<typeof ImMemberInfoSchema>;

export const ImSessionSummarySchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  name: z.string().nullable(),
  type: z.enum(['private', 'group', 'channel']),
  avatarUrl: z.string().nullable(),
  members: z.array(ImMemberInfoSchema),
  lastMessageId: z.string().nullable().optional(),
  memberLastMessageId: z.string().nullable().optional(),
  lastMessageAt: z.string().nullable(),
  lastMessagePreview: z.string().nullable(),
  unreadCount: z.number().optional(),
  createdAt: z.string(),
});
export type ImSessionSummary = z.infer<typeof ImSessionSummarySchema>;

export const ImSessionDetailSchema = ImSessionSummarySchema.extend({
  description: z.string().nullable(),
  creatorId: z.string().nullable(),
  members: z.array(ImMemberInfoSchema),
});
export type ImSessionDetail = z.infer<typeof ImSessionDetailSchema>;

export const ImMessageInfoSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  senderId: z.string().nullable(),
  senderName: z.string().optional(),
  messageType: z.enum(['text', 'image', 'file', 'system']),
  content: z.string(),
  replyToId: z.string().nullable(),
  attachments: z
    .array(
      z.object({
        type: z.string(),
        url: z.string(),
        name: z.string().optional(),
        size: z.number().optional(),
      }),
    )
    .nullable(),
  isEdited: z.boolean(),
  createdAt: z.string(),
});
export type ImMessageInfo = z.infer<typeof ImMessageInfoSchema>;

// ========== Request Types ==========

export interface CreateSessionRequest {
  type: ChatSessionType;
  name?: string;
  description?: string;
  avatarUrl?: string;
  memberIds?: string[];
}

export interface SendMessageRequest {
  content: string;
  messageType?: ChatMessageType;
  replyToId?: string;
  attachments?: Array<{
    type: string;
    url: string;
    name?: string;
    size?: number;
  }>;
}

export interface AddMemberRequest {
  principalId: string;
  role?: ChatMemberRole;
}

export interface GetMessagesRequest {
  limit?: number;
  before?: string;
  after?: string;
}
