import { Column, Entity, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';
import { KnowledgeBookType } from '../enums/knowledge.enums';

/**
 * @title 知识书本实体
 * @description 存储知识书本的基本信息：类型（技能/学识）、名称、描述、创建人，以及描述向量。
 * @keywords-cn 知识书本, 技能, 学识, 向量, 书架
 * @keywords-en knowledge-book, skill, lore, vector, bookshelf
 */
@Entity('knowledge_books')
@Index(['type'])
@Index(['creatorId'])
export class KnowledgeBookEntity extends BaseAuditedEntity {
  /** 书本类型：skill=技能 / lore=学识 */
  @Column({ name: 'type', type: 'varchar', length: 16 })
  type!: KnowledgeBookType;

  /** 知识名称 */
  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  /** 知识描述（用于向量化） */
  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  /** 创建人 principal_id */
  @Column({ name: 'creator_id', type: 'char', length: 36, nullable: true })
  creatorId!: string | null;

  /** 描述向量（pgvector，float[]） */
  @Column({ name: 'embedding', type: 'vector', nullable: true })
  embedding!: string | null;

  /** 是否已完成向量化 */
  @Column({ name: 'is_embedded', type: 'boolean', default: false })
  isEmbedded!: boolean;

  /** 是否启用 */
  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;
}
