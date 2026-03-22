import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';
import { PluginStatus } from '../enums/solution.enums';
import { SolutionSource, SolutionInclude } from '../enums/solution.enums';

/**
 * @title Solution 实体
 * @description Solution 元信息表，支持解决方案市场和分页功能
 * @keywords-cn Solution表, 解决方案市场, Solution管理, 分页
 * @keywords-en solution-entity, solution-marketplace, solution-management, pagination
 */
@Entity('plugins')
@Unique('UQ_PLUGIN_NAME_VERSION', ['name', 'version'])
@Index(['tenantId'])
@Index(['tags'])
export class SolutionEntity extends BaseAuditedEntity {
  /** 关联 Runner ID 列表 */
  @Column({ name: 'runner_ids', type: 'json', nullable: true })
  runnerIds!: string[] | null;

  /** 租户 ID */
  @Column({ name: 'tenant_id', type: 'char', length: 36, nullable: true })
  @Index()
  tenantId!: string | null;

  /** Solution 名称 */
  @Column({ type: 'varchar', length: 255 })
  @Index()
  name!: string;

  /** Solution 版本 */
  @Column({ type: 'varchar', length: 64 })
  version!: string;

  /** Solution 简述（用于卡片展示） */
  @Column({ name: 'summary', type: 'varchar', length: 500, nullable: true })
  summary!: string | null;

  /** Solution 详细描述 */
  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** Solution 图标 URL */
  @Column({ name: 'icon_url', type: 'varchar', length: 512, nullable: true })
  iconUrl!: string | null;

  /** Solution 标签（JSON 数组） */
  @Column({ type: 'json', nullable: true })
  tags!: string[] | null;

  /** 作者名称 */
  @Column({ name: 'author_name', type: 'varchar', length: 128, nullable: true })
  authorName!: string | null;

  /** 作者 ID */
  @Column({ name: 'author_id', type: 'char', length: 36, nullable: true })
  authorId!: string | null;

  /** Markdown 详细描述（支持图片） */
  @Column({ name: 'markdown_content', type: 'text', nullable: true })
  markdownContent!: string | null;

  /** Solution 目录位置 */
  @Column({ name: 'plugin_dir', type: 'varchar', length: 512, nullable: true })
  pluginDir!: string | null;

  /** 安装次数 */
  @Column({ name: 'install_count', type: 'int', default: 0 })
  installCount!: number;

  /** 评分（0-5） */
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating!: number;

  /** Solution 状态 */
  @Column({
    name: 'status',
    type: 'varchar',
    length: 32,
    default: PluginStatus.ACTIVE,
  })
  status!: PluginStatus;

  /** 是否在市场发布 */
  @Column({ name: 'is_published', type: 'boolean', default: false })
  isPublished!: boolean;

  /** 是否已安装（租户视角） */
  @Column({ name: 'is_installed', type: 'boolean', default: false })
  isInstalled!: boolean;

  /** Solution 来源 */
  @Column({
    name: 'source',
    type: 'varchar',
    length: 32,
    default: SolutionSource.SELF_DEVELOPED,
  })
  source!: SolutionSource;

  /** Runner 内绝对路径 */
  @Column({ name: 'location', type: 'varchar', length: 512, nullable: true })
  location!: string | null;

  /** 插件介绍图片列表 */
  @Column({ name: 'images', type: 'json', nullable: true })
  images!: string[] | null;

  /** Solution 包含内容 */
  @Column({ name: 'includes', type: 'json', nullable: true })
  includes!: SolutionInclude[] | null;
}
