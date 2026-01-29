import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from './base.entity';

/**
 * @title 会话智能分析实体
 * @description 对会话记录进行分段分析，存储关键词和向量，供 AI 工具智能读取。
 * @keywords-cn 会话分析, 分段, 关键词, 向量, AI工具
 * @keywords-en session-smart, segment, keywords, vector, ai-tool
 */
@Entity('chat_session_smart')
@Index(['sessionId'])
@Index(['startMessageId'])
@Index(['endMessageId'])
@Index(['analyzedAt'])
export class ChatSessionSmartEntity extends BaseAuditedEntity {
  /** 会话 ID */
  @Column({ name: 'session_id', type: 'char', length: 36 })
  sessionId!: string;

  /** 分段起始消息 ID */
  @Column({ name: 'start_message_id', type: 'char', length: 36 })
  startMessageId!: string;

  /** 分段结束消息 ID */
  @Column({ name: 'end_message_id', type: 'char', length: 36 })
  endMessageId!: string;

  /** 消息数量 (通常 5-10 条) */
  @Column({ name: 'message_count', type: 'int', default: 0 })
  messageCount!: number;

  /**
   * @title AI 分析关键词
   * @description JSON 格式：{ zh: string[], en: string[] }
   */
  @Column({ name: 'keywords', type: 'json', nullable: true })
  keywords!: { zh: string[]; en: string[] } | null;

  /** 向量存储 (pgvector) */
  @Column({ name: 'embedding', type: 'vector', nullable: true })
  embedding!: string | null;

  /** AI 生成的分段摘要 */
  @Column({ name: 'summary', type: 'text', nullable: true })
  summary!: string | null;

  /** 分析完成时间 */
  @Column({ name: 'analyzed_at', type: 'timestamp', nullable: true })
  analyzedAt!: Date | null;
}
