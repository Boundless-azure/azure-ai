import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title LangGraph 写入实体
 * @description 存储与检查点关联的中间写入（pending writes）。
 * @keywords-cn LangGraph, 写入, pending, TypeORM
 * @keywords-en langgraph, writes, pending, typeorm
 * @keyword-cn LangGraph, 写入, 工作流上下文
 * @keyword-en langgraph, writes, workflow-context
 */
@Entity('lg_writes')
@Index(['threadId'])
@Index(['threadId', 'checkpointNs'])
@Index(['threadId', 'checkpointNs', 'checkpointId'])
@Index(['sessionId'])
@Index(['agentId'])
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

  @Column({ name: 'session_id', type: 'varchar', length: 100, nullable: true })
  sessionId?: string | null;

  @Column({ name: 'agent_id', type: 'varchar', length: 36, nullable: true })
  agentId?: string | null;

  @Column({
    name: 'agent_principal_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  agentPrincipalId?: string | null;

  @Column({ name: 'ai_model_ids', type: 'json', nullable: true })
  aiModelIds?: string[] | null;

  @Column({ name: 'task_id', type: 'varchar', length: 128 })
  taskId!: string;

  @Column({ name: 'idx', type: 'int' })
  idx!: number;

  @Column({ name: 'channel', type: 'varchar', length: 128 })
  channel!: string;

  @Column({ name: 'value_type', type: 'varchar', length: 128 })
  valueType!: string;

  /** 写入值的原始 JSON 文本 (曾为 base64, 已去掉那层多此一举的编码) */
  @Column({ name: 'value_json', type: 'text' })
  valueJson!: string;
}
