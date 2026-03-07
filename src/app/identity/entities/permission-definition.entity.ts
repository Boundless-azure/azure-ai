import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';
import { PermissionDefinitionType } from '../enums/permission.enums';

/**
 * @title PermissionDefinition 实体
 * @description 权限定义：subject/action 的可选描述，用于 UI 枚举与选择。
 * @keywords-cn 权限定义, 资源, 动作
 * @keywords-en permission-definition, subject, action
 */
@Entity('permission_definitions')
@Index(['fid'])
@Index(['nodeKey'])
@Index(['permissionType'])
export class PermissionDefinitionEntity extends BaseAuditedEntity {
  @Column({ name: 'fid', type: 'char', length: 36, nullable: true })
  fid!: string | null;

  @Column({ name: 'node_key', type: 'varchar', length: 64 })
  nodeKey!: string;

  @Column({
    name: 'permission_type',
    type: 'varchar',
    length: 32,
    default: PermissionDefinitionType.Management,
  })
  permissionType!: PermissionDefinitionType;

  @Column({ name: 'extra_data', type: 'json', nullable: true })
  extraData!: Record<string, unknown> | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;
}
