import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('plugins')
@Unique('UQ_PLUGIN_NAME_VERSION', ['name', 'version'])
export class PluginEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  name!: string;

  @Column({ type: 'varchar', length: 64 })
  version!: string;

  @Column({ type: 'text' })
  description!: string;

  // hooks 以 JSON 字符串形式存储（数组：{ name, payloadDescription }）
  @Column({ type: 'text' })
  hooks!: string;

  // 关键词（中文 / 英文），逗号分隔的文本，便于 FULLTEXT 索引
  @Column({ name: 'keywords_zh', type: 'text', nullable: true })
  keywordsZh?: string | null;

  @Column({ name: 'keywords_en', type: 'text', nullable: true })
  keywordsEn?: string | null;

  // 插件目录位置（相对项目根，例如 plugins/customer-analytics）
  @Column({ name: 'plugin_dir', type: 'varchar', length: 512 })
  pluginDir!: string;

  // 注册标识：true 表示已录入（不通过自动扫描）
  @Column({ type: 'boolean', default: true })
  registered!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
