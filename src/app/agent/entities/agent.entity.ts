import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title Agent 实体
 * @description 存储 Agent 元信息、关联向量与节点图结构。
 * @keywords-cn Agent表, 拟人昵称, 用途说明, 关联向量, 节点图, 对话组
 * @keywords-en agent-entity, nickname, purpose, embedding, nodes-graph, conversation-group
 */
@Entity('agents')
@Index(['codeDir'])
export class AgentEntity extends BaseAuditedEntity {
  /** 代码指向目录 */
  @Column({ name: 'code_dir', type: 'varchar', length: 255 })
  codeDir!: string;

  /** 拟人昵称 */
  @Column({ name: 'nickname', type: 'varchar', length: 100 })
  nickname!: string;

  /** 是否由 AI 产生 */
  @Column({ name: 'is_ai_generated', type: 'boolean', default: false })
  isAiGenerated!: boolean;

  /** 用途说明（业务描述） */
  @Column({ name: 'purpose', type: 'text', nullable: true })
  purpose!: string | null;

  /** 关联向量（pgvector） */
  @Column({ name: 'embedding', type: 'vector', nullable: true })
  embedding!: string | null;

  /** 关联的主体 ID */
  @Column({ name: 'principal_id', type: 'char', length: 36, nullable: true })
  principalId!: string | null;

  /** 关键词数组（JSON 存储，做为回退匹配机制） */
  @Column({ name: 'keywords', type: 'json', nullable: true })
  keywords!: string[] | null;

  /** 节点图定义（JSON），包含各节点与其空间位置 */
  @Column({ name: 'nodes', type: 'json', nullable: true })
  nodes!: Record<string, unknown> | null;

  /** 是否启用 */
  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;
}
