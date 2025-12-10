import { Entity, Column, Index, Unique } from 'typeorm';
import { BaseAuditedEntity } from './base.entity';

/**
 * @title 轮次总结实体
 * @description 存储每个会话的阶段性轮次总结（默认每20轮）。
 * @keywords-cn 会话总结, 轮次, 摘要, TypeORM
 * @keywords-en session-summary, rounds, recap, typeorm
 */
@Entity('summary_table')
@Unique('UQ_SUMMARY_SESSION_ROUND', ['sessionId', 'roundNumber'])
@Index(['sessionId'])
export class RoundSummaryEntity extends BaseAuditedEntity {
  @Column({ name: 'session_id', type: 'varchar', length: 100 })
  sessionId!: string;

  @Column({ name: 'round_number', type: 'int' })
  roundNumber!: number;

  @Column({ name: 'summary_content', type: 'text' })
  summaryContent!: string;
}
