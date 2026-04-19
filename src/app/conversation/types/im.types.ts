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
  IsBoolean,
  ValidateNested,
  IsInt,
  MaxLength,
  Min,
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
 * 更新会话请求（群名、描述等）
 */
export class UpdateImSessionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
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
 * 邀请成员（用于群聊加人 / 私聊拉群）
 */
export class InviteMembersDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  principalIds!: string[];
}

export interface InviteMembersResponse {
  sessionId: string;
  action: 'created_group' | 'added_to_session' | 'noop';
  sessionName?: string;
  addedCount?: number;
  systemText?: string;
}

/**
 * 成员信息
 */
export interface ImMemberInfo {
  principalId: string;
  displayName: string;
  avatarUrl?: string | null;
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

  /** @mention 信息数组 */
  @IsOptional()
  @IsArray()
  mentions?: MentionInfo[];
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
  isAnnouncement: boolean;
  createdAt: Date;
  /** @mention 信息数组 */
  mentions?: MentionInfo[];
}

export type ImMessageListResponse = ImCursorResult<ImMessageInfo>;

// ========== 公告相关类型 ==========

/**
 * 发布公告请求
 */
export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}

/**
 * 获取公告列表请求
 */
export class GetAnnouncementsDto {
  @IsOptional()
  limit?: number;
}

export interface ImAnnouncementListResponse {
  items: ImMessageInfo[];
  total: number;
}

/**
 * 转移群主请求
 */
export class TransferOwnerDto {
  @IsString()
  @IsNotEmpty()
  principalId!: string;
}

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
  /** @mention 的目标 principal_id（agent 或普通用户均可）*/
  principalId: string;
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

// ========== 通讯录分组相关类型 ==========

/**
 * @title 创建通讯录分组请求
 * @description 创建当前主体的联系人分组。
 * @keywords-cn 创建分组, 通讯录分组, 联系人分组
 * @keywords-en create-group, contact-group, address-book-group
 */
export class CreateImContactGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}

/**
 * @title 更新通讯录分组请求
 * @description 重命名/调整排序/启用或禁用分组。
 * @keywords-cn 更新分组, 重命名, 排序, 启用
 * @keywords-en update-group, rename, sort-order, active
 */
export class UpdateImContactGroupDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/**
 * @title 批量添加分组成员请求
 * @description 将一批主体 ID 添加到指定分组。
 * @keywords-cn 添加分组成员, 批量, 主体ID
 * @keywords-en add-members, batch, principal-ids
 */
export class AddImContactGroupMembersDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  principalIds!: string[];
}

/**
 * @title 通讯录分组信息
 * @description 分组列表返回的扁平结构，包含成员数量。
 * @keywords-cn 分组信息, 成员数量, 列表
 * @keywords-en group-info, member-count, list
 */
export interface ImContactGroupInfo {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}
