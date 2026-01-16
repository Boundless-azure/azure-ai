import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title RolePermission 实体
 * @description 角色权限规则：subject/action/conditions。
 * @keywords-cn 权限, 角色权限, 规则
 * @keywords-en permission, role-permission, rules
 */
@Entity('role_permissions')
@Index(['roleId'])
@Index(['subject'])
@Index(['action'])
export class RolePermissionEntity extends BaseAuditedEntity {
  @Column({ name: 'role_id', type: 'char', length: 36 })
  roleId!: string;

  @Column({ name: 'subject', type: 'varchar', length: 64 })
  subject!: string;

  @Column({ name: 'action', type: 'varchar', length: 64 })
  action!: string;

  @Column({ name: 'conditions', type: 'json', nullable: true })
  conditions!: Record<string, unknown> | null;
}
