import { Entity, Column, Index, Unique } from 'typeorm';
import { BaseAuditedEntity } from './base.entity';
import { ChatSessionType } from '../enums/chat.enums';

/**
 * @title 聊天会话实体
 * @description IM 会话表，支持私聊、群聊、频道。
 * @keywords-cn 会话, 私聊, 群聊, 频道, IM
 * @keywords-en session, dm, group, channel, im
 */
@Entity('chat_sessions')
@Index(['creatorId'])
@Index(['type'])
@Unique(['sessionId'])
export class ChatSessionEntity extends BaseAuditedEntity {
  /** 业务会话唯一键 */
  @Column({ name: 'session_id', length: 100 })
  sessionId!: string;

  /** 会话名称 */
  @Column({ name: 'name', type: 'varchar', length: 255, nullable: true })
  name!: string | null;

  /** 会话类型：私聊/群聊/频道 */
  @Column({
    name: 'type',
    type: 'enum',
    enum: ChatSessionType,
    default: ChatSessionType.Private,
  })
  type!: ChatSessionType;

  /** 创建者主体 ID */
  @Column({ name: 'creator_id', type: 'char', length: 36, nullable: true })
  creatorId!: string | null;

  /** 会话头像 URL */
  @Column({ name: 'avatar_url', type: 'varchar', length: 255, nullable: true })
  avatarUrl!: string | null;

  /** 会话描述 */
  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  /** 自定义元数据 */
  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata?: Record<string, any>;

  /** 是否启用 */
  @Column({ default: true })
  active!: boolean;

  // ========== 向后兼容字段（已弃用，迁移后将移除） ==========

  /**
   * @deprecated 使用 creatorId 替代。仅用于向后兼容 context.service.ts。
   */
  @Column({ name: 'user_id', type: 'varchar', length: 100, nullable: true })
  userId?: string | null;

  /**
   * @deprecated 系统提示词已移至应用层。仅用于向后兼容。
   */
  @Column({ name: 'system_prompt', type: 'text', nullable: true })
  systemPrompt?: string;

  /**
   * @deprecated 对话组概念已移除。仅用于向后兼容。
   */
  @Column({
    name: 'conversation_group_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  conversationGroupId?: string | null;
}
