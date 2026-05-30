import { Column, Entity, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title 任务实体
 * @description 存储任务名称、描述、关联人、里程碑、PM、关联文件夹与所属会话。
 * @keywords-cn 任务实体, 任务表, 里程碑, PM, 文件夹
 * @keywords-en task-entity, task-table, milestone, pm, folder
 */
@Entity('tasks')
@Index(['sessionId'])
@Index(['pmId'])
@Index(['folderPath'])
export class TaskEntity extends BaseAuditedEntity {
  /** 任务名称 */
  @Column({ name: 'title', type: 'varchar', length: 255 })
  title!: string;

  /** 任务描述 */
  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  /** 任务关联人 ID 列表 */
  @Column({ name: 'assigneeids', type: 'json', nullable: true })
  assigneeIds!: string[] | null;

  /** 任务里程碑 */
  @Column({ name: 'milestone', type: 'varchar', length: 255, nullable: true })
  milestone!: string | null;

  /** 任务 PM 主体 ID */
  @Column({ name: 'pmid', type: 'varchar', length: 36, nullable: true })
  pmId!: string | null;

  /** 关联资源库文件夹路径 */
  @Column({ name: 'folder_path', type: 'varchar', length: 512, nullable: true })
  folderPath!: string | null;

  /** 关联会话 ID */
  @Column({ name: 'session_id', type: 'varchar', length: 100, nullable: true })
  sessionId!: string | null;

  /** 是否启用 */
  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;
}
