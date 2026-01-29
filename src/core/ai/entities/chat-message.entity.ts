import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from './base.entity';
import { ChatMessageType } from '../enums/chat.enums';

/**
 * @title 聊天消息实体
 * @description IM 消息表，支持多种消息类型和消息回复。
 * @keywords-cn 消息, IM, 回复, 发送者
 * @keywords-en message, im, reply, sender
 */
@Entity('chat_session_messages')
@Index(['sessionId'])
@Index(['senderId'])
@Index(['sessionId', 'createdAt'])
@Index(['replyToId'])
export class ChatMessageEntity extends BaseAuditedEntity {
  /** 会话 ID */
  @Column({ name: 'session_id', length: 100 })
  sessionId!: string;

  /** 发送者主体 ID */
  @Column({ name: 'sender_id', type: 'char', length: 36, nullable: true })
  senderId!: string | null;

  /** 消息类型 */
  @Column({
    name: 'message_type',
    type: 'enum',
    enum: ChatMessageType,
    default: ChatMessageType.Text,
  })
  messageType!: ChatMessageType;

  /** 消息正文 */
  @Column({ type: 'text' })
  content!: string;

  /** 回复的消息 ID (用于消息引用) */
  @Column({ name: 'reply_to_id', type: 'char', length: 36, nullable: true })
  replyToId!: string | null;

  /** 附件信息 (JSON) */
  @Column({ name: 'attachments', type: 'json', nullable: true })
  attachments!: Array<{
    type: string;
    url: string;
    name?: string;
    size?: number;
  }> | null;

  /** 自定义元数据 */
  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata?: Record<string, any> | null;

  /** 是否已编辑 */
  @Column({ name: 'is_edited', type: 'boolean', default: false })
  isEdited!: boolean;

  /** 编辑时间 */
  @Column({ name: 'edited_at', type: 'timestamp', nullable: true })
  editedAt!: Date | null;

  // ========== 向后兼容字段（已弃用，迁移后将移除） ==========

  /**
   * @deprecated 使用 senderId + messageType 替代。仅用于向后兼容 context.service.ts。
   * 映射关系：'system' -> MessageType.System, 'user'/'assistant' -> 根据 senderId 类型判断
   */
  @Column({
    name: 'role',
    type: 'enum',
    enum: ['system', 'user', 'assistant'],
    default: 'user',
  })
  role!: 'system' | 'user' | 'assistant';

  /**
   * @deprecated 关键词已移至 chat_session_smart 表。仅用于向后兼容。
   */
  @Column({ name: 'keywords', type: 'json', nullable: true })
  keywords?: { zh: string[]; en: string[] } | null;
}
