import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title User 实体
 * @description 人类用户扩展表，存储认证信息。关联到 Principal 主体表。
 * @keywords-cn 用户, 密码, 认证, 扩展表
 * @keywords-en user, password, authentication, extension
 */
@Entity('users')
@Index(['principalId'], { unique: true })
@Index(['email'], { unique: true })
export class UserEntity extends BaseAuditedEntity {
  /** 关联的主体 ID */
  @Column({ name: 'principal_id', type: 'char', length: 36 })
  principalId!: string;

  /** 用户邮箱 (用于登录) */
  @Column({ name: 'email', type: 'varchar', length: 255 })
  email!: string;

  /**
   * @title 密码哈希
   * @description 使用 scrypt 生成的哈希值，配合 salt 校验。
   */
  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  passwordHash!: string | null;

  /**
   * @title 密码盐值
   * @description 随机生成的盐值，配合 scrypt 计算哈希。
   */
  @Column({
    name: 'password_salt',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  passwordSalt!: string | null;

  /** 最后登录时间 */
  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt!: Date | null;

  /** 登录失败次数 */
  @Column({ name: 'login_attempts', type: 'int', default: 0 })
  loginAttempts!: number;

  /** 账号锁定截止时间 */
  @Column({ name: 'locked_until', type: 'timestamp', nullable: true })
  lockedUntil!: Date | null;
}
