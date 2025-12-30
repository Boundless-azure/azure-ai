import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title 执行Agent 实体
 * @description 存储任务说明、引用的 Agent、节点状态、最新返回与关联上下文。
 * @keywords-cn 执行Agent表, 任务说明, 节点状态, 最新返回, 上下文关联
 * @keywords-en agent-execution, task, node-status, latest-response, context-link
 */
@Entity('agent_executions')
@Index(['agentId'])
@Index(['contextMessageId'])
export class AgentExecutionEntity extends BaseAuditedEntity {
  /** 引用的 Agent ID */
  @Column({ name: 'agent_id', type: 'char', length: 36 })
  agentId!: string;

  /** 任务说明 */
  @Column({ name: 'task_description', type: 'text' })
  taskDescription!: string;

  /** 节点状态（JSON，会对照） */
  @Column({ name: 'node_status', type: 'json', nullable: true })
  nodeStatus!: Record<string, unknown> | null;

  /** 最新 agent 返回信息（结构化 JSON） */
  @Column({ name: 'latest_response', type: 'json', nullable: true })
  latestResponse!: Record<string, unknown> | null;

  /** 关联上下文（产生该执行的调用消息ID或上下文键） */
  @Column({
    name: 'context_message_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  contextMessageId!: string | null;

  /** 是否启用 */
  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;
}
