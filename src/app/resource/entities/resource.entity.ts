import { Column, Entity, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title 资源实体
 * @description 统一存储上传资源的元信息（上传者、文件信息、SHA256、MD5、存储路径与去重关系，支持分片上传和断点续传）。
 * @keywords-cn 资源表, 文件上传, SHA256去重, 上传者, 存储路径, 分片上传
 * @keywords-en resource-entity, file-upload, sha256-dedup, uploader, storage-path, chunked-upload
 */
@Entity('resources')
@Index(['md5'])
@Index(['sha256'])
@Index(['uploaderId'])
@Index(['category'])
@Index(['isDelete'])
export class ResourceEntity extends BaseAuditedEntity {
  @Column({ name: 'uploader_id', type: 'char', length: 36, nullable: true })
  uploaderId!: string | null;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ name: 'file_ext', type: 'varchar', length: 32, nullable: true })
  fileExt!: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 128, nullable: true })
  mimeType!: string | null;

  @Column({ name: 'file_size', type: 'bigint' })
  fileSize!: string;

  /** MD5 用于快速初筛（前端可先传 MD5 试探） */
  @Column({ name: 'md5', type: 'varchar', length: 64 })
  md5!: string;

  /** SHA-256 用于最终去重和完整性校验 */
  @Column({ name: 'sha256', type: 'varchar', length: 64, nullable: true })
  sha256!: string | null;

  /** 大文件抽样校验标识：true=抽样SHA256，false=全量SHA256 */
  @Column({ name: 'sha256_sampled', type: 'boolean', default: false })
  sha256Sampled!: boolean;

  @Column({ name: 'category', type: 'varchar', length: 32 })
  category!: string;

  @Column({ name: 'storage_path', type: 'text' })
  storagePath!: string;

  @Column({ name: 'copied_from_id', type: 'char', length: 36, nullable: true })
  copiedFromId!: string | null;

  /** 分片上传总片数，0表示不分片 */
  @Column({ name: 'chunk_total', type: 'int', default: 0 })
  chunkTotal!: number;

  /** 已接收的分片位图，用十六进制字符串存储，如 "0xFF" 表示前8片已收 */
  @Column({ name: 'chunk_bitmap', type: 'varchar', length: 128, default: '' })
  chunkBitmap!: string;

  /** 临时分片存放目录 */
  @Column({
    name: 'chunk_temp_dir',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  chunkTempDir!: string | null;

  /** 分片文件过期清理时间 */
  @Column({ name: 'chunk_expires_at', type: 'timestamptz', nullable: true })
  chunkExpiresAt!: Date | null;

  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;
}
