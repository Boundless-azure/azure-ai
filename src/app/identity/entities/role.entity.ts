import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title Role 实体
 * @description RBAC 角色定义，支持组织作用域与系统级角色。
 * @keywords-cn 角色, RBAC, 组织作用域
 * @keywords-en role, rbac, org-scope
 */
@Entity('roles')
@Index(['organizationId'])
@Index(['code'])
export class RoleEntity extends BaseAuditedEntity {
  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'code', type: 'varchar', length: 64 })
  code!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'organization_id', type: 'char', length: 36, nullable: true })
  organizationId!: string | null;

  @Column({ name: 'builtin', type: 'boolean', default: false })
  builtin!: boolean;
}
