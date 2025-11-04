import { Entity, Column, Index, Unique } from 'typeorm';
import { BaseAuditedEntity } from './base.entity';

/**
 * 聊天会话实体
 * 用于存储聊天会话的持久化信息
 */
@Entity('chat_sessions')
@Index(['userId'])
@Unique(['sessionId'])
export class ChatSessionEntity extends BaseAuditedEntity {
  // 统一主键使用 BaseAuditedEntity.id (uuid)
  // 保留原 sessionId 作为业务唯一键
  @Column({ name: 'session_id', length: 100 })
  sessionId!: string;

  @Column({ name: 'user_id', length: 100, nullable: true })
  userId!: string;

  @Column({ name: 'system_prompt', type: 'text', nullable: true })
  systemPrompt!: string;

  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata!: Record<string, any>;

  @Column({ default: true })
  active!: boolean;
}
