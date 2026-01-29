import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title Membership 实体
 * @description 组织成员关系与角色。
 * @keywords-cn 成员关系, 角色
 * @keywords-en membership, role
 */
@Entity('memberships')
@Index(['organizationId'])
@Index(['principalId'])
@Index(['roleId'])
export class MembershipEntity extends BaseAuditedEntity {
  @Column({ name: 'organization_id', type: 'char', length: 36 })
  organizationId!: string;

  @Column({ name: 'principal_id', type: 'char', length: 36 })
  principalId!: string;

  @Column({ name: 'role_id', type: 'char', length: 36, nullable: true })
  roleId!: string | null;

  @Column({ name: 'department', type: 'varchar', length: 255, nullable: true })
  department!: string | null;

  @Column({ name: 'tags', type: 'json', nullable: true })
  tags!: string[] | null;

  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;
}
