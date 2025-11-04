import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from './base.entity';

/**
 * 聊天消息记录实体（一条消息一条记录）
 * - 与会话通过 session_id 关联（引用 chat_sessions.session_id 唯一键）
 * - 每条消息可包含关键词分析与元数据
 */
@Entity('chat_session_messages')
@Index(['sessionId'])
@Index(['sessionId', 'createdAt'])
@Index(['sessionId', 'role'])
export class ChatMessageEntity extends BaseAuditedEntity {
  /** 业务会话唯一键（字符串），与 chat_sessions.session_id 对齐 */
  @Column({ name: 'session_id', length: 100 })
  sessionId!: string;

  /** 消息角色：system/user/assistant */
  @Column({ type: 'enum', enum: ['system', 'user', 'assistant'] })
  role!: 'system' | 'user' | 'assistant';

  /** 消息正文 */
  @Column({ type: 'text' })
  content!: string;

  /**
   * 关键词分析结果（JSON）：
   * { zh: string[], en: string[] }
   */
  @Column({ name: 'keywords', type: 'json', nullable: true })
  keywords?: { zh: string[]; en: string[] } | null;

  /** 自定义元数据 */
  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata?: Record<string, any> | null;
}
