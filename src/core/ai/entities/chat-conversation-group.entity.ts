import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from './base.entity';

@Entity('chat_conversation_groups')
@Index(['dayGroupId'])
@Index(['isDelete'])
export class ChatConversationGroupEntity extends BaseAuditedEntity {
  @Column({ name: 'day_group_id', type: 'char', length: 36 })
  dayGroupId!: string;

  @Column({
    name: 'chat_client_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  chatClientId!: string | null;

  @Column({ name: 'title', type: 'varchar', length: 255, nullable: true })
  title!: string | null;

  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;
}
