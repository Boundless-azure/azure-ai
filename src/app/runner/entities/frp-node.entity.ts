import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * @title FRP 节点实体
 * @description 存储 FRP 节点信息，包括 IP 地址、端口、Token、地区和状态。
 * @keywords-cn FRP节点, IP地址, 端口, Token, 地区
 * @keywords-en frp-node, ip-address, port, token, region
 */
@Entity('frp_nodes')
@Index(['status'])
export class FrpNodeEntity {
  @PrimaryColumn({ name: 'id', type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'node_ip', type: 'varchar', length: 45 })
  nodeIp!: string;

  @Column({ name: 'node_port', type: 'int', default: 7000 })
  nodePort!: number;

  @Column({ name: 'node_address', type: 'varchar', length: 255 })
  nodeAddress!: string;

  @Column({ name: 'token', type: 'varchar', length: 128, default: '' })
  token!: string;

  @Column({ name: 'status', type: 'varchar', length: 32, default: 'active' })
  status!: string;
}
