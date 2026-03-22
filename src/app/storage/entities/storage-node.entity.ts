import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title 存储节点枚举
 * @description 节点类型和分享模式枚举
 * @keywords-cn 存储节点, 节点类型, 分享模式
 * @keywords-en storage-node, node-type, share-mode
 */
export enum StorageNodeType {
  FOLDER = 'folder',
  FILE = 'file',
}

export enum ShareMode {
  NONE = 'none',
  TEMP = 'temp',
  PERMANENT = 'permanent',
  PASSWORD = 'password',
}

/**
 * @title 存储节点实体
 * @description 统一资源库目录结构，支持文件夹和文件，集成租户隔离和分享功能。
 * @keywords-cn 存储节点, 目录结构, 租户隔离, 分享链接
 * @keywords-en storage-node, directory-tree, tenant-isolation, share-link
 */
@Entity('storage_nodes')
@Index(['tenantId', 'parentId'])
@Index(['tenantId'])
@Index(['shareToken'])
export class StorageNodeEntity extends BaseAuditedEntity {
  /** 租户 ID */
  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  /** 父节点 ID（null 表示根目录） */
  @Column({ name: 'parent_id', type: 'char', length: 36, nullable: true })
  parentId!: string | null;

  /** 节点名称 */
  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  /** 节点类型（文件夹/文件） */
  @Column({ name: 'type', type: 'varchar', length: 32 })
  type!: StorageNodeType;

  /** 完整路径（如 /documents/reports/q1.pdf） */
  @Column({ name: 'path', type: 'text' })
  path!: string;

  /** 文件大小（仅对文件类型有效） */
  @Column({ name: 'size', type: 'bigint', nullable: true })
  size!: string | null;

  /** MIME 类型（仅对文件类型有效） */
  @Column({ name: 'mime_type', type: 'varchar', length: 128, nullable: true })
  mimeType!: string | null;

  /** 关联的资源 ID（仅对文件类型有效，关联 resource 表） */
  @Column({ name: 'resource_id', type: 'char', length: 36, nullable: true })
  resourceId!: string | null;

  /** 分享模式 */
  @Column({
    name: 'share_mode',
    type: 'varchar',
    length: 32,
    default: ShareMode.NONE,
  })
  shareMode!: ShareMode;

  /** 分享密码（加密存储） */
  @Column({
    name: 'share_password',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  sharePassword!: string | null;

  /** 分享过期时间 */
  @Column({ name: 'share_expires_at', type: 'timestamptz', nullable: true })
  shareExpiresAt!: Date | null;

  /** 分享 Token（唯一） */
  @Column({ name: 'share_token', type: 'varchar', length: 64, nullable: true })
  shareToken!: string | null;

  /** 是否启用 */
  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;

  // 关系
  @ManyToOne(() => StorageNodeEntity, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: StorageNodeEntity | null;
}
