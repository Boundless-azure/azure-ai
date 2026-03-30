import { Column, Entity, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title 奖励记录实体
 * @description 存储奖励发放记录，包括奖励类型、关联主体和描述信息。
 * @keywords-cn 奖励记录, 发放记录, 域名奖励
 * @keywords-en reward-record, grant-record, domain-reward
 */
@Entity('reward_records')
@Index(['rewardType', 'relatedId'])
@Index(['relatedId'])
export class RewardRecordEntity extends BaseAuditedEntity {
  @Column({ name: 'reward_type', type: 'varchar', length: 64 })
  rewardType!: string;

  @Column({ name: 'related_id', type: 'char', length: 36 })
  relatedId!: string;

  @Column({ name: 'description', type: 'varchar', length: 500, nullable: true })
  description!: string | null;
}
