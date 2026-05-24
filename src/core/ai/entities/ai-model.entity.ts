import { Entity, Column, Index } from 'typeorm';
import { AIModelApiSpec, AIModelType, AIModelStatus } from '../types';
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

  @Column({
    type: 'varchar',
    length: 50,
  })
  provider!: string;

  @Column({
    type: 'enum',
    enum: AIModelApiSpec,
    default: AIModelApiSpec.OPENAI,
  })
  apiProtocol!: AIModelApiSpec;

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

  /**
   * 思考模式开关 (think / reasoning) :: 独立 boolean 列, 便于 SQL 过滤 / 索引
   *  - Anthropic Claude 4.x extended thinking (budget_tokens=4096)
   *  - OpenAI o-series reasoning (reasoning_effort='medium')
   *  - Gemini 2.5 thinking (thinkingBudget=4096)
   *  - DeepSeek-R1 自带, 不需此字段
   * @keyword-en thinking-mode-toggle
   */
  @Column({ name: 'thinking_enabled', type: 'boolean', default: false })
  thinkingEnabled!: boolean;

  /**
   * 该模型的 smart 历史分段字符阈值: session 累计可见正文达到该阈值后, 用该模型生成摘要 + 关键词并写一个 smart 段。
   *   - 不同模型上下文承载力差异大: 一些模型 8k 后输出质量就明显下降, 应设小阈值 (e.g. 3000); 长上下文模型 (Claude / Gemini) 可设大 (e.g. 8000+)
   *   - null 时走全局兜底 (代码常量 5000)
   *   - smart 压缩模型 = 该 session 当前 agent 关联的第一个 ai model; 不同 agent 阈值不同时各自跑各自的
   * @keyword-en smart-segment-chars, context-budget, model-aware-summary
   */
  @Column({ name: 'smart_segment_chars', type: 'int', nullable: true })
  smartSegmentChars!: number | null;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ default: true })
  enabled!: boolean;
}
