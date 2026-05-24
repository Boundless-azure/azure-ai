import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title Organization 实体
 * @description 组织/租户基础信息。
 * @keywords-cn 组织, 租户
 * @keywords-en organization, tenant
 */
@Entity('organizations')
@Index(['name'])
export class OrganizationEntity extends BaseAuditedEntity {
  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'code', type: 'varchar', length: 64, nullable: true })
  code!: string | null;

  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;
}
