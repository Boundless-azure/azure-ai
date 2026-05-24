import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title LangGraph 写入实体
 * @description 存储与检查点关联的中间写入（pending writes）。
 * @keywords-cn LangGraph, 写入, pending, TypeORM
 * @keywords-en langgraph, writes, pending, typeorm
 */
@Entity('lg_writes')
@Index(['threadId'])
@Index(['threadId', 'checkpointNs'])
@Index(['threadId', 'checkpointNs', 'checkpointId'])
export class LGWriteEntity extends BaseAuditedEntity {
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

  @Column({ name: 'task_id', type: 'varchar', length: 128 })
  taskId!: string;

  @Column({ name: 'idx', type: 'int' })
  idx!: number;

  @Column({ name: 'channel', type: 'varchar', length: 128 })
  channel!: string;

  @Column({ name: 'value_type', type: 'varchar', length: 128 })
  valueType!: string;

  @Column({ name: 'value_b64', type: 'text' })
  valueB64!: string;
}
