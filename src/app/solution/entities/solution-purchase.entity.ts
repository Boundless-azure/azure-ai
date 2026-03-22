import { Column, Entity, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';
import { SolutionSource } from '../enums/solution.enums';

/**
 * @title Solution 购买记录实体
 * @description 记录用户在市场购买 Solution 的历史
 * @keywords-cn Solution购买记录, 购买历史, 市场购买
 * @keywords-en solution-purchase, purchase-history, marketplace
 */
@Entity('solution_purchases')
@Index(['userId'])
@Index(['solutionId'])
export class SolutionPurchaseEntity extends BaseAuditedEntity {
  /** 购买用户 ID */
  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId!: string;

  /** Solution ID */
  @Column({ name: 'solution_id', type: 'char', length: 36 })
  solutionId!: string;

  /** Solution 名称 */
  @Column({ name: 'solution_name', type: 'varchar', length: 255 })
  solutionName!: string;

  /** Solution 版本 */
  @Column({ name: 'solution_version', type: 'varchar', length: 64 })
  solutionVersion!: string;

  /** 安装到的 Runner ID */
  @Column({ name: 'runner_id', type: 'char', length: 36, nullable: true })
  runnerId!: string | null;

  /** Solution 来源 */
  @Column({
    name: 'source',
    type: 'varchar',
    length: 32,
    default: SolutionSource.MARKETPLACE,
  })
  source!: SolutionSource;

  /** 购买时间 */
  @Column({ name: 'purchased_at', type: 'timestamptz' })
  purchasedAt!: Date;
}
