import { Column, Entity, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';
import { TodoStatus } from '../enums/todo.enums';

/**
 * @title 待办事项实体
 * @description 存储发起人、标题、关联插件、内容说明、action 数据、接收人、状态与回执结果。
 * @keywords-cn 待办事项表, 发起人, 关联插件, 回执结果
 * @keywords-en todo-entity, initiator, plugin, receipt
 */
@Entity('todos')
@Index(['initiatorId'])
@Index(['recipientId'])
@Index(['status'])
export class TodoEntity extends BaseAuditedEntity {
  /** 发起人 ID（用户或系统主体） */
  @Column({ name: 'initiator_id', type: 'char', length: 36 })
  initiatorId!: string;

  /** 待办名 */
  @Column({ name: 'title', type: 'varchar', length: 255 })
  title!: string;

  /** 关联插件 ID（可空） */
  @Column({ name: 'plugin_id', type: 'char', length: 36, nullable: true })
  pluginId!: string | null;

  /** 待办内容说明 */
  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  /** 待办 action（前端处理用的任意 JSON 数据） */
  @Column({ name: 'action', type: 'json', nullable: true })
  action!: Record<string, unknown> | null;

  /** 接收人 ID */
  @Column({ name: 'recipient_id', type: 'char', length: 36 })
  recipientId!: string;

  /** 待办状态 */
  @Column({ name: 'status', type: 'varchar', length: 32 })
  status!: TodoStatus;

  /** 回执结果（结构化 JSON） */
  @Column({ name: 'receipt', type: 'json', nullable: true })
  receipt!: Record<string, unknown> | null;

  /** 是否启用（便于筛选活跃项） */
  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;
}
