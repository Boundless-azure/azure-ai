import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title IM Contact Group Member Entity
 * @description 通讯录分组成员：记录 groupId 下被分组的联系人主体（memberPrincipalId）。
 * @keywords-cn 分组成员, 联系人, 成员表, IM分组成员
 * @keywords-en group-member, contact, member-table, im-group-member
 */
@Entity('im_contact_group_members')
@Index(['groupId'])
@Index(['ownerPrincipalId'])
@Index(['memberPrincipalId'])
@Index(['groupId', 'memberPrincipalId'])
@Index(['groupId', 'isDelete'])
export class ImContactGroupMemberEntity extends BaseAuditedEntity {
  @Column({ name: 'group_id', type: 'char', length: 36 })
  groupId!: string;

  @Column({ name: 'owner_principal_id', type: 'char', length: 36 })
  ownerPrincipalId!: string;

  @Column({ name: 'member_principal_id', type: 'char', length: 36 })
  memberPrincipalId!: string;
}
