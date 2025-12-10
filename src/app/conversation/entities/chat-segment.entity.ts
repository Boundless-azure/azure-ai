import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title 会话分段实体
 * @description 基于某天的消息集合进行分段，仅做组合引用，不修改原始消息记录
 * @keywords-cn 会话分段, 天维度, 组合, 只读引用
 * @keywords-en conversation-segment, day-dimension, composition, reference-only
 */
@Entity('chat_segments')
@Index(['sessionId'])
@Index(['sessionId', 'day'])
export class ChatSegmentEntity extends BaseAuditedEntity {
  /** 会话唯一键 */
  @Column({ name: 'session_id', length: 100 })
  sessionId!: string;

  /** 天维度键（YYYY-MM-DD） */
  @Column({ name: 'day', length: 10 })
  day!: string;

  /** 分段名称 */
  @Column({ name: 'name', length: 200 })
  name!: string;

  /** 分段说明 */
  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string | null;

  /** 该分段包含的消息ID集合（只做引用，不复制内容） */
  @Column({ name: 'message_ids', type: 'json' })
  messageIds!: string[];
}
