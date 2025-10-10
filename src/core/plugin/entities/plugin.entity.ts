import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseAuditedEntity } from '../../ai/entities/base.entity';

/**
 * 插件实体（TypeORM）
 * - 表名：plugins
 * - 唯一约束：name + version（避免重复录入同名同版本）
 */
@Entity('plugins')
@Unique('UQ_PLUGIN_NAME_VERSION', ['name', 'version'])
export class PluginEntity extends BaseAuditedEntity {
  /** 主键 ID（UUID v7，继承自 BaseAudititedEntity {
  /** 主键 ID（UUID v7，继承自 BaseAuditedEntity） */
  // id: string; // 由基类提供

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

  // hooks 以 JSON 字符串形式存储（数组：{ name, payloadDescription }）
  /** hooks 以 JSON 字符串形式存储（数组：{ name, payloadDescription }） */
  @Column({ type: 'text' })
  hooks!: string;

  // 关键词（中文 / 英文），逗号分隔的文本，便于 FULLTEXT 索引
  /** 中文关键词（逗号分隔文本，便于全文索引） */
  @Column({ name: 'keywords_zh', type: 'text', nullable: true })
  keywordsZh?: string | null;

  /** 英文关键词（逗号分隔文本，便于全文索引） */
  @Column({ name: 'keywords_en', type: 'text', nullable: true })
  keywordsEn?: string | null;

  // 插件目录位置（相对项目根，例如 plugins/customer-analytics）
  /** 插件目录位置（相对项目根，例如 plugins/customer-analytics） */
  @Column({ name: 'plugin_dir', type: 'varchar', length: 512 })
  pluginDir!: string;

  // 注册标识：true 表示已录入（不通过自动扫描）
  /** 注册标识：true 表示已录入（非自动扫描） */
  @Column({ type: 'boolean', default: true })
  registered!: boolean;

  // 审计与软删除字段由 BaseAuditedEntity 提供：
  // createdUser, updateUser, channelId, isDelete, createdAt, updatedAt, deletedAt
}
