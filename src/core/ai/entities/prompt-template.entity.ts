import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from './base.entity';

/**
 * Prompt模板实体
 * 用于存储可重用的Prompt模板
 */
@Entity('prompt_templates')
@Index(['category', 'enabled'])
export class PromptTemplateEntity extends BaseAuditedEntity {
  // id/created_at/updated_at/created_user/update_user/channel_id/is_delete/deleted_at 由 BaseAuditedEntity 提供

  @Column({ length: 100 })
  @Index()
  name!: string;

  @Column({ type: 'text' })
  template!: string;

  @Column({ type: 'json' })
  variables!: string[];

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ length: 50, nullable: true })
  category!: string;

  @Column({ default: true })
  enabled!: boolean;
}
