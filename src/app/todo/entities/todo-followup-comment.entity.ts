import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title 待办跟进评论实体
 * @description 存储待办跟进记录的评论，支持每个跟进记录有多条评论
 * @keywords-cn 待办评论, 跟进评论, 评论管理
 * @keywords-en todo-comment, followup-comment, comment
 */
@Entity('todo_followup_comments')
@Index(['followupId'])
export class TodoFollowupCommentEntity extends BaseAuditedEntity {
  /** 关联跟进记录ID */
  @Column({ name: 'followupId', type: 'char', length: 36 })
  followupId!: string;

  /** 评论人ID */
  @Column({ name: 'userId', type: 'char', length: 36 })
  userId!: string;

  /** 评论人名称 */
  @Column({ name: 'userName', type: 'varchar', length: 128, nullable: true })
  userName!: string | null;

  /** 评论人头像 */
  @Column({ name: 'userAvatar', type: 'varchar', length: 512, nullable: true })
  userAvatar!: string | null;

  /** 评论内容 */
  @Column({ name: 'content', type: 'text' })
  content!: string;
}
