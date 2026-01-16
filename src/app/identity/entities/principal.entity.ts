import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';
import { PrincipalType } from '../enums/principal.enums';

/**
 * @title Principal 实体
 * @description 统一身份主体（企业用户、消费者、官方账号、Agent、系统）。
 * @keywords-cn 主体, 用户, 官方账号, Agent, 系统
 * @keywords-en principal, user, official, agent, system
 */
@Entity('principals')
@Index(['principalType'])
@Index(['tenantId'])
export class PrincipalEntity extends BaseAuditedEntity {
  @Column({ name: 'display_name', type: 'varchar', length: 255 })
  displayName!: string;

  @Column({ name: 'principal_type', type: 'varchar', length: 32 })
  principalType!: PrincipalType;

  @Column({ name: 'avatar_url', type: 'varchar', length: 255, nullable: true })
  avatarUrl!: string | null;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 64, nullable: true })
  phone!: string | null;

  @Column({ name: 'tenant_id', type: 'char', length: 36, nullable: true })
  tenantId!: string | null;

  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;

  /**
   * @title 密码哈希
   * @description 使用 scrypt 生成的哈希值，配合 salt 校验。
   * @keywords-cn 密码哈希, 登录
   * @keywords-en password-hash, login
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
   * @keywords-cn 盐值, scrypt
   * @keywords-en salt, scrypt
   */
  @Column({
    name: 'password_salt',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  passwordSalt!: string | null;
}
