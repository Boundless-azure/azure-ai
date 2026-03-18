import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';
import { RunnerStatus } from '../enums/runner.enums';

/**
 * @title Runner 实体
 * @description 存储 Runner 基础信息、主体账号关联、注册密钥哈希与在线状态。
 * @keywords-cn Runner实体, 主体账号, 注册密钥, 在线状态
 * @keywords-en runner-entity, principal-account, register-key, online-status
 */
@Entity('runners')
@Unique('UQ_RUNNER_ALIAS', ['alias'])
@Index(['principalId'])
@Index(['status'])
export class RunnerEntity extends BaseAuditedEntity {
  @Column({ name: 'alias', type: 'varchar', length: 120 })
  alias!: string;

  @Column({ name: 'runner_key_hash', type: 'varchar', length: 128 })
  runnerKeyHash!: string;

  @Column({
    name: 'runner_key_plain',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  runnerKeyPlain!: string | null;

  @Column({ name: 'principal_id', type: 'char', length: 36 })
  principalId!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'status', type: 'varchar', length: 32 })
  status!: RunnerStatus;

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt!: Date | null;

  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;
}
