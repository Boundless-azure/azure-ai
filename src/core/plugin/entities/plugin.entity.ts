import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseAuditedEntity } from '../../ai/entities/base.entity';

/**
 * @title 应用实体（TypeORM）
 * @description 应用元信息表（由 plugin 模块演进而来）：支持 session 关联、向量与关键词检索。
 * @keywords-cn 应用表, apps, 会话关联, 向量, 关键词, hooks
 * @keywords-en app-entity, apps, session, embedding, keywords, hooks
 */
@Entity('apps')
@Unique('UQ_APP_NAME_VERSION', ['name', 'version'])
export class AppEntity extends BaseAuditedEntity {
  /** 关联的 IM 会话 ID（可选，用于按会话隔离应用集合） */
  @Column({ name: 'session_id', type: 'varchar', length: 100, nullable: true })
  @Index()
  sessionId!: string | null;

  /** 插件名称（带索引，便于查询与统计） */
  @Column({ type: 'varchar', length: 255 })
  @Index()
  name!: string;

  /** 插件版本（例如 1.0.0） */
  @Column({ type: 'varchar', length: 64 })
  version!: string;

  /** 插件描述（中文或英文，便于 AI 生成关键词） */
  @Column({ type: 'text' })
  description!: string;

  /** hooks 以 JSON 字符串形式存储（数组：{ name, payloadDescription }） */
  @Column({ type: 'text' })
  hooks!: string;

  /** 向量字段（pgvector），用于向量检索 */
  @Column({ name: 'embedding', type: 'vector', nullable: true })
  embedding!: string | null;

  /** 关键词数组（JSON 存储，做为回退匹配机制） */
  @Column({ name: 'keywords', type: 'json', nullable: true })
  keywords!: string[] | null;

  // 关键词（中文 / 英文），逗号分隔的文本，便于 FULLTEXT 索引
  /** 中文关键词（逗号分隔文本，便于全文索引） */
  @Column({ name: 'keywords_zh', type: 'text', nullable: true })
  keywordsZh?: string | null;

  /** 英文关键词（逗号分隔文本，便于全文索引） */
  @Column({ name: 'keywords_en', type: 'text', nullable: true })
  keywordsEn?: string | null;

  /** 插件目录位置（相对项目根，例如 plugins/customer-analytics） */
  @Column({ name: 'plugin_dir', type: 'varchar', length: 512 })
  pluginDir!: string;

  /** 注册标识：true 表示已录入（非自动扫描） */
  @Column({ type: 'boolean', default: true })
  registered!: boolean;

  // 审计与软删除字段由 BaseAuditedEntity 提供：
  // createdUser, updateUser, channelId, isDelete, createdAt, updatedAt, deletedAt
}

export { AppEntity as PluginEntity };
