import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseAuditedEntity } from '../../ai/entities/base.entity';

/**
 * @title 应用子单元实体（TypeORM）
 * @description 应用下的子模块/子单元（例如 CRM 的多个子模块），支持 session 关联、向量与关键词检索。
 * @keywords-cn 应用子模块, app-unit, unit表, 会话关联, 向量, 关键词
 * @keywords-en app-unit-entity, unit, session, embedding, keywords
 */
@Entity('app_units')
@Unique('UQ_APP_UNIT_APP_ID_NAME', ['appId', 'name'])
export class AppUnitEntity extends BaseAuditedEntity {
  /** 关联的 IM 会话 ID（可选，用于按会话隔离 unit 集合） */
  @Column({ name: 'session_id', type: 'varchar', length: 100, nullable: true })
  @Index()
  sessionId!: string | null;

  /** 归属应用 ID */
  @Column({ name: 'app_id', type: 'char', length: 36 })
  @Index()
  appId!: string;

  /** 子单元名称（英文，用作唯一键的一部分） */
  @Column({ type: 'varchar', length: 255 })
  @Index()
  name!: string;

  /** 子单元版本（例如 1.0.0） */
  @Column({ type: 'varchar', length: 64, nullable: true })
  version!: string | null;

  /** 子单元描述 */
  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** 向量字段（pgvector），用于向量检索 */
  @Column({ name: 'embedding', type: 'vector', nullable: true })
  embedding!: string | null;

  /** 关键词数组（JSON 存储，做为回退匹配机制） */
  @Column({ name: 'keywords', type: 'json', nullable: true })
  keywords!: string[] | null;

  /** 中文关键词（逗号分隔文本，便于全文索引） */
  @Column({ name: 'keywords_zh', type: 'text', nullable: true })
  keywordsZh!: string | null;

  /** 英文关键词（逗号分隔文本，便于全文索引） */
  @Column({ name: 'keywords_en', type: 'text', nullable: true })
  keywordsEn!: string | null;

  /** 是否启用 */
  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;
}
