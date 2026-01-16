import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';
import { MembershipRole } from '../enums/principal.enums';

/**
 * @title Membership 实体
 * @description 组织成员关系与角色。
 * @keywords-cn 成员关系, 角色
 * @keywords-en membership, role
 */
@Entity('memberships')
@Index(['organizationId'])
@Index(['principalId'])
@Index(['role'])
export class MembershipEntity extends BaseAuditedEntity {
  @Column({ name: 'organization_id', type: 'char', length: 36 })
  organizationId!: string;

  @Column({ name: 'principal_id', type: 'char', length: 36 })
  principalId!: string;

  @Column({ name: 'role', type: 'varchar', length: 32 })
  role!: MembershipRole;

  @Column({ name: 'department', type: 'varchar', length: 255, nullable: true })
  department!: string | null;

  @Column({ name: 'tags', type: 'json', nullable: true })
  tags!: string[] | null;

  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;
}
