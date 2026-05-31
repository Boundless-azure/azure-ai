import { Column, Entity, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title AgentKnowledgeAssignment 实体
 * @description Agent 与知识书本的绑定关系表。仅持久化自定义分配，本地知识由服务层自动并入默认集合。
 * @keywords-cn Agent知识分配, 绑定关系, 知识书本
 * @keywords-en agent-knowledge-assignment, binding, knowledge-book
 */
@Entity('agent_knowledge_assignments')
@Index(['agentId'])
@Index(['bookId'])
@Index(['agentId', 'bookId', 'isDelete'], { unique: true })
export class AgentKnowledgeAssignmentEntity extends BaseAuditedEntity {
  @Column({ name: 'agent_id', type: 'varchar', length: 36 })
  agentId!: string;

  @Column({ name: 'book_id', type: 'varchar', length: 100 })
  bookId!: string;
}