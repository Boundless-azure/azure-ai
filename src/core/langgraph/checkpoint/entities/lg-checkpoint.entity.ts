import { Entity, Column, Index, Unique } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title LangGraph 检查点实体
 * @description 存储 BaseCheckpointSaver 规范下的检查点快照与元数据。
 * @keywords-cn LangGraph, 检查点, TypeORM, 快照, 元数据
 * @keywords-en langgraph, checkpoint, typeorm, snapshot, metadata
 */
@Entity('lg_checkpoints')
@Unique('UQ_LG_THREAD_NS_ID', ['threadId', 'checkpointNs', 'checkpointId'])
@Index(['threadId'])
@Index(['threadId', 'checkpointNs'])
export class LGCheckpointEntity extends BaseAuditedEntity {
  @Column({ name: 'thread_id', type: 'varchar', length: 100 })
  threadId!: string;

  @Column({
    name: 'checkpoint_ns',
    type: 'varchar',
    length: 100,
    default: 'default',
  })
  checkpointNs!: string;

  @Column({ name: 'checkpoint_id', type: 'varchar', length: 128 })
  checkpointId!: string;

  @Column({ name: 'checkpoint_json', type: 'text' })
  checkpointJson!: string;

  @Column({ name: 'metadata_json', type: 'json', nullable: true })
  metadataJson?: Record<string, unknown> | null;

  @Column({ name: 'parents_json', type: 'json', nullable: true })
  parentsJson?: Record<string, string> | null;
}
