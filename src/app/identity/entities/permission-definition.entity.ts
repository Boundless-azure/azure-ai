import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';
import { PermissionDefinitionType } from '../enums/permission.enums';

/**
 * @title PermissionDefinition 实体
 * @description 权限定义节点表 (subject/action/数据节点的 SSOT)。
 *              weight 表示该节点的层级权重:
 *              - 配置时越权防护 :: 管理员要修改/分配/删除涉及此节点的权限, 自身在该 subject 上的最高权重必须 ≥ 此节点 weight
 *              - 数值越大权限越高, admin 这种"全开"角色应授予最高权重的通配定义
 * @keywords-cn 权限定义, 资源, 动作, 权重, 越权防护
 * @keywords-en permission-definition, subject, action, weight, escalation-guard
 */
@Entity('permission_definitions')
@Index(['fid'])
@Index(['nodeKey'])
@Index(['permissionType'])
export class PermissionDefinitionEntity extends BaseAuditedEntity {
  @Column({ name: 'fid', type: 'char', length: 36, nullable: true })
  fid!: string | null;

  @Column({ name: 'node_key', type: 'varchar', length: 64 })
  nodeKey!: string;

  @Column({
    name: 'permission_type',
    type: 'varchar',
    length: 32,
    default: PermissionDefinitionType.Management,
  })
  permissionType!: PermissionDefinitionType;

  /**
   * 节点权重 :: int, 默认 0
   * - 数值越大代表权限层级越高
   * - 管理 API 越权防护 :: 操作者在该节点对应 subject 上的最高权重 必须 ≥ 目标节点 weight 才能修改/分配
   * - 数据权限节点装饰器 (@DataPermissionNode) 启动期同步该值, 装饰器是 SSOT
   * @keyword-en permission-definition-weight
   */
  @Column({ name: 'weight', type: 'int', default: 0 })
  weight!: number;

  @Column({ name: 'extra_data', type: 'json', nullable: true })
  extraData!: Record<string, unknown> | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;
}
