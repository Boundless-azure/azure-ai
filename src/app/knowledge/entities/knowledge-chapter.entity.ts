import { Column, Entity, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title 知识章节实体
 * @description 每本知识书本的章节目录条目，包含章节标题、排序和标记（是否为 AI 必读章节）。
 * @keywords-cn 知识章节, 目录, 排序, AI必读
 * @keywords-en knowledge-chapter, toc, sort-order, lm-required
 */
@Entity('knowledge_chapters')
@Index(['bookId'])
@Index(['bookId', 'sortOrder'])
export class KnowledgeChapterEntity extends BaseAuditedEntity {
  /** 所属书本 ID */
  @Column({ name: 'book_id', type: 'char', length: 36 })
  bookId!: string;

  /** 章节标题 */
  @Column({ name: 'title', type: 'varchar', length: 255 })
  title!: string;

  /** 排序序号（升序） */
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  /**
   * 是否为 LM 必读章节
   * 获取任意章节内容时，LM 必读章节始终附带返回
   */
  @Column({ name: 'is_lm_required', type: 'boolean', default: false })
  isLmRequired!: boolean;

  /** 章节 Markdown 内容 */
  @Column({ name: 'content', type: 'text', nullable: true })
  content!: string | null;
}
