import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title IM Contact Group Entity
 * @description 通讯录分组：用于按当前主体（ownerPrincipalId）维护联系人分组。
 * @keywords-cn 通讯录分组, 联系人分组, IM分组, 分组表
 * @keywords-en contact-group, address-book-group, im-group, group-table
 */
@Entity('im_contact_groups')
@Index(['ownerPrincipalId'])
@Index(['ownerPrincipalId', 'isDelete'])
@Index(['ownerPrincipalId', 'name'])
export class ImContactGroupEntity extends BaseAuditedEntity {
  @Column({ name: 'owner_principal_id', type: 'char', length: 36 })
  ownerPrincipalId!: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;
}
