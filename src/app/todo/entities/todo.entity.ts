import { Column, Entity, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';
import { TodoStatus } from '../enums/todo.enums';

/**
 * @title 待办事项实体
 * @description 存储待办名称、描述、跟进人、发起人、具体内容、状态等信息。
 * @keywords-cn 待办事项表, 跟进人, 发起人, 内容
 * @keywords-en todo-entity, follower, initiator, content
 */
@Entity('todos')
@Index(['initiatorId'])
@Index(['status'])
export class TodoEntity extends BaseAuditedEntity {
  /** 发起人 ID（用户或系统主体） */
  @Column({ name: 'initiator_id', type: 'char', length: 36 })
  initiatorId!: string;

  /** 待办名称 */
  @Column({ name: 'title', type: 'varchar', length: 255 })
  title!: string;

  /** 待办描述说明 */
  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  /** 待办具体内容 (markdown格式) */
  @Column({ name: 'content', type: 'text', nullable: true })
  content!: string | null;

  /** 跟进人ID列表 (JSON数组) */
  @Column({ name: 'followerids', type: 'json', nullable: true })
  followerIds!: string[] | null;

  /** 状态dot颜色 */
  @Column({ name: 'statuscolor', type: 'varchar', length: 16, nullable: true })
  statusColor!: string | null;

  /** 待办状态 */
  @Column({ name: 'status', type: 'varchar', length: 32 })
  status!: TodoStatus;

  /** 是否启用（便于筛选活跃项） */
  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;
}
