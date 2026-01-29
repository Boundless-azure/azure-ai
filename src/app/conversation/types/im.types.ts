/**
 * @title IM 类型定义
 * @description IM 消息、会话、成员相关的请求/响应类型和 DTO。
 * @keywords-cn IM, 消息, 会话, 成员, DTO
 * @keywords-en im, message, session, member, dto
 */

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ChatSessionType,
  ChatMessageType,
  ChatMemberRole,
} from '@core/ai/enums/chat.enums';

// ========== 会话相关类型 ==========

/**
 * 创建会话请求
 */
export class CreateImSessionDto {
  @IsEnum(ChatSessionType)
  type!: ChatSessionType;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  /** 初始成员 ID 列表（不含创建者） */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  memberIds?: string[];
}

/**
 * 会话简要信息（用于列表）
 */
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
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  unreadCount?: number;
  createdAt: Date;
}

export interface ImCursorResult<TItem> {
  items: TItem[];
  cursor: string | null;
}

export type ImSessionListResponse = ImCursorResult<ImSessionSummary>;

/**
 * 会话详情
 */
export interface ImSessionDetail extends ImSessionSummary {
  description: string | null;
  creatorId: string | null;
  members: ImMemberInfo[];
}

// ========== 成员相关类型 ==========

/**
 * 添加成员请求
 */
export class AddMemberDto {
  @IsString()
  @IsNotEmpty()
  principalId!: string;

  @IsOptional()
  @IsEnum(ChatMemberRole)
  role?: ChatMemberRole;
}

/**
 * 成员信息
 */
export interface ImMemberInfo {
  principalId: string;
  displayName: string;
  role: ChatMemberRole;
  joinedAt: Date | null;
  lastReadAt: Date | null;
}

// ========== 消息相关类型 ==========

/**
 * 附件结构
 */
export class AttachmentDto {
  @IsString()
  type!: string;

  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  size?: number;
}

/**
 * 发送消息请求
 */
export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsEnum(ChatMessageType)
  messageType?: ChatMessageType;

  @IsOptional()
  @IsUUID('all')
  replyToId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}

/**
 * 消息信息
 */
export interface ImMessageInfo {
  id: string;
  sessionId: string;
  senderId: string | null;
  senderName?: string;
  messageType: ChatMessageType;
  content: string;
  replyToId: string | null;
  attachments: AttachmentDto[] | null;
  isEdited: boolean;
  createdAt: Date;
}

export type ImMessageListResponse = ImCursorResult<ImMessageInfo>;

export class GetSessionsDto {
  @IsOptional()
  @IsUUID('all')
  last_message_id?: string;

  @IsOptional()
  limit?: number;
}

/**
 * 获取消息历史请求
 */
export class GetMessagesDto {
  @IsOptional()
  limit?: number;

  @IsOptional()
  @IsUUID('all')
  last_message_id?: string;

  @IsOptional()
  @IsUUID('all')
  before?: string;

  @IsOptional()
  @IsUUID('all')
  after?: string;

  /** 增量查询：自指定时间（ISO 字符串）之后的消息 */
  @IsOptional()
  @IsString()
  since?: string;
}

/**
 * 检查是否有新消息请求
 */
export class GetHasNewDto {
  @IsString()
  @IsNotEmpty()
  since!: string; // ISO 字符串
}

/**
 * 检查是否有新消息响应
 */
export interface HasNewResponse {
  hasNew: boolean;
  count?: number;
  lastMessageAt?: Date;
}

// ========== WebSocket 事件类型 ==========

/**
 * IM WebSocket 事件类型
 */
export type ImWsEvent =
  | { type: 'im:message'; data: ImMessageInfo; sessionId: string }
  | {
      type: 'im:typing';
      data: { userId: string; isTyping: boolean };
      sessionId: string;
    }
  | {
      type: 'im:read';
      data: { userId: string; messageId: string };
      sessionId: string;
    }
  | { type: 'im:member_joined'; data: ImMemberInfo; sessionId: string }
  | { type: 'im:member_left'; data: { principalId: string }; sessionId: string }
  | { type: 'ai:stream_start'; sessionId: string; agentId: string }
  | { type: 'ai:token'; data: { text: string }; sessionId: string }
  | { type: 'ai:stream_end'; sessionId: string; messageId: string }
  | { type: 'error'; error: string; sessionId?: string };

/**
 * 加入会话房间请求
 */
export class JoinSessionDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;
}

/**
 * 输入状态请求
 */
export class TypingDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  isTyping!: boolean;
}

/**
 * 已读回执请求
 */
export class ReadReceiptDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsUUID('all')
  messageId!: string;
}

// ========== AI 触发相关 ==========

/**
 * 提取的 @mention 信息
 */
export interface MentionInfo {
  /** Agent 的 principal_id */
  agentPrincipalId: string;
  /** 原始 @mention 文本 */
  mentionText: string;
  /** 在消息中的位置 */
  startIndex: number;
  endIndex: number;
}

/**
 * AI 响应请求（内部使用）
 */
export interface AgentResponseRequest {
  sessionId: string;
  agentPrincipalId: string;
  triggerMessageId: string;
  userContent: string;
}
