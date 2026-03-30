import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title 待办跟进记录实体
 * @description 存储待办事项的跟进记录，包含跟进人、时间、内容和状态
 * @keywords-cn 待办跟进, 跟进记录, 时间轴
 * @keywords-en todo-followup, followup-record, timeline
 */
@Entity('todo_followups')
@Index(['todoId'])
export class TodoFollowupEntity extends BaseAuditedEntity {
  /** 关联待办ID */
  @Column({ name: 'todoid', type: 'char', length: 36 })
  todoId!: string;

  /** 跟进人ID */
  @Column({ name: 'followerid', type: 'char', length: 36 })
  followerId!: string;

  /** 跟进人名称 */
  @Column({
    name: 'followername',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  followerName!: string | null;

  /** 跟进人头像 */
  @Column({
    name: 'followeravatar',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  followerAvatar!: string | null;

  /** 跟进时状态 */
  @Column({ name: 'status', type: 'varchar', length: 32 })
  status!: string;

  /** 跟进内容 (markdown格式) */
  @Column({ name: 'content', type: 'text', nullable: true })
  content!: string | null;
}
