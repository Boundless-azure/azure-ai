import { Entity, Column, Index } from 'typeorm';
import { AIProvider, AIModelType, AIModelStatus } from '../types';
import { BaseAuditedEntity } from './base.entity';

/**
 * AI模型实体
 * 用于存储AI模型的配置信息
 */
@Entity({ name: 'ai_models' })
@Index(['provider', 'type'])
@Index(['status', 'enabled'])
export class AIModelEntity extends BaseAuditedEntity {
  // id/created_at/updated_at/created_user/update_user/channel_id/is_delete/deleted_at 由 BaseAuditedEntity 提供

  @Column({ length: 100 })
  @Index()
  name!: string;

  @Column({ length: 200, nullable: true })
  displayName!: string;

  // 使用 MySQL 的 enum 类型
  @Column({
    type: 'enum',
    enum: AIProvider,
  })
  provider!: AIProvider;

  // 使用 MySQL 的 enum 类型
  @Column({
    type: 'enum',
    enum: AIModelType,
  })
  type!: AIModelType;

  // 使用 MySQL 的 enum 类型
  @Column({
    type: 'enum',
    enum: AIModelStatus,
    default: AIModelStatus.ACTIVE,
  })
  status!: AIModelStatus;

  @Column({ length: 500 })
  apiKey!: string;

  @Column({ length: 500, nullable: true })
  baseURL!: string;

  @Column({ type: 'json', nullable: true })
  azureConfig!: {
    resourceName: string;
    deploymentName: string;
    apiVersion: string;
  };

  @Column({ type: 'json', nullable: true })
  defaultParams!: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  };

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ default: true })
  enabled!: boolean;
}
