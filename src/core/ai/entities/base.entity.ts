import {
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  BeforeInsert,
} from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

/**
 * 统一基础实体字段
 * - 主键 id 使用 UUID（应用侧使用 UUID v7 以保留时序）
 * - 审计与租户字段：created_user、update_user、channel_id
 * - 软删除支持：is_delete（布尔标记） + deleted_at（TypeORM软删除支持）
 * - 时间戳：created_at、updated_at 使用 snake_case
 */
export abstract class BaseAuditedEntity {
  // 应用侧生成 UUID v7，数据库不设置默认值，避免 MySQL 对 DEFAULT 函数的限制
  // 注意：不使用装饰器 default，统一在 @BeforeInsert 中生成，确保 save() 后实体存在 id
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'created_user', type: 'char', length: 36, nullable: true })
  createdUser!: string;

  @Column({ name: 'update_user', type: 'char', length: 36, nullable: true })
  updateUser!: string;

  @Column({ name: 'channel_id', type: 'varchar', length: 100, nullable: true })
  channelId!: string;

  // 使用 boolean，MySQL 下映射为 TINYINT(1)，默认 false(0)
  @Column({ name: 'is_delete', type: 'boolean', default: false })
  isDelete!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // TypeORM软删除支持（当使用 repository.softRemove/softDelete 时填充）
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;

  // 在插入前确保存在主键 id（使用 UUID v7 保留时序特性）
  @BeforeInsert()
  protected ensureId(): void {
    if (!this.id) {
      this.id = uuidv7();
    }
  }
}
