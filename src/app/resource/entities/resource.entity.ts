import { Column, Entity, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title 资源实体
 * @description 统一存储上传资源的元信息（上传者、文件信息、MD5、存储路径与去重关系）。
 * @keywords-cn 资源表, 文件上传, MD5去重, 上传者, 存储路径
 * @keywords-en resource-entity, file-upload, md5-dedup, uploader, storage-path
 */
@Entity('resources')
@Index(['md5'])
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

  @Column({ name: 'md5', type: 'varchar', length: 64 })
  md5!: string;

  @Column({ name: 'category', type: 'varchar', length: 32 })
  category!: string;

  @Column({ name: 'storage_path', type: 'text' })
  storagePath!: string;

  @Column({ name: 'copied_from_id', type: 'char', length: 36, nullable: true })
  copiedFromId!: string | null;

  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;
}
