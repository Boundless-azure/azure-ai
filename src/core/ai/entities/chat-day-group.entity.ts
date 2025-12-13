import { Entity, Column, Unique, Index } from 'typeorm';
import { BaseAuditedEntity } from './base.entity';

@Entity('chat_day_groups')
@Unique(['date'])
@Index(['date'])
export class ChatDayGroupEntity extends BaseAuditedEntity {
  @Column({ name: 'date', type: 'varchar', length: 20 })
  date!: string;

  @Column({ name: 'title', type: 'varchar', length: 255, nullable: true })
  title!: string | null;
}
