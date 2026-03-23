import { Column, Entity, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';

/**
 * @title FRP 记录实体
 * @description 存储 Runner 的 FRP 隧道记录，包括端口分配和节点地址。
 * @keywords-cn FRP记录, 端口分配, 隧道记录
 * @keywords-en frp-record, port-allocation, tunnel-record
 */
@Entity('frp_records')
@Index(['runnerId'])
@Index(['port'])
export class FrpRecordEntity extends BaseAuditedEntity {
  @Column({ name: 'runner_id', type: 'char', length: 36 })
  runnerId!: string;

  @Column({ name: 'domain', type: 'varchar', length: 255 })
  domain!: string;

  @Column({ name: 'frp_node_addr', type: 'varchar', length: 255, default: 'default' })
  frpNodeAddr!: string;

  @Column({ name: 'port', type: 'int', unique: true })
  port!: number;

  @Column({ name: 'frps_port', type: 'int', default: 7000 })
  frpsPort!: number;

  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;
}
