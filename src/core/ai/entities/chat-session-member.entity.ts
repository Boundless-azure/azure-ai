import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from './base.entity';
import { ChatMemberRole } from '../enums/chat.enums';

/**
 * @title 会话成员实体
 * @description 会话成员关系表，管理群聊/私聊的成员。
 * @keywords-cn 会话成员, 群聊, 私聊, 成员角色
 * @keywords-en session-member, group-chat, dm, member-role
 */
@Entity('chat_session_members')
@Index(['sessionId'])
@Index(['principalId'])
@Index(['sessionId', 'principalId'], { unique: true })
export class ChatSessionMemberEntity extends BaseAuditedEntity {
  /** 会话 ID */
  @Column({ name: 'session_id', type: 'char', length: 36 })
  sessionId!: string;

  /** 成员主体 ID */
  @Column({ name: 'principal_id', type: 'char', length: 36 })
  principalId!: string;

  /** 成员角色 */
  @Column({
    name: 'role',
    type: 'enum',
    enum: ChatMemberRole,
    default: ChatMemberRole.Member,
  })
  role!: ChatMemberRole;

  /** 加入时间 */
  @Column({ name: 'joined_at', type: 'timestamp', nullable: true })
  joinedAt!: Date | null;

  /** 禁言截止时间 */
  @Column({ name: 'muted_until', type: 'timestamp', nullable: true })
  mutedUntil!: Date | null;

  /** 最后已读时间 */
  @Column({ name: 'last_read_at', type: 'timestamp', nullable: true })
  lastReadAt!: Date | null;

  /** 最后已读消息 ID */
  @Column({
    name: 'last_read_message_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  lastReadMessageId!: string | null;
}
