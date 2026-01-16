import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title PermissionDefinition 实体
 * @description 权限定义：subject/action 的可选描述，用于 UI 枚举与选择。
 * @keywords-cn 权限定义, 资源, 动作
 * @keywords-en permission-definition, subject, action
 */
@Entity('permission_definitions')
@Index(['subject'])
@Index(['action'])
export class PermissionDefinitionEntity extends BaseAuditedEntity {
  @Column({ name: 'subject', type: 'varchar', length: 64 })
  subject!: string;

  @Column({ name: 'action', type: 'varchar', length: 64 })
  action!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;
}
