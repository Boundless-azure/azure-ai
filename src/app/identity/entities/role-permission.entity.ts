import { Entity, Column, Index } from 'typeorm';
import { BaseAuditedEntity } from '@core/ai/entities/base.entity';
import { PermissionDefinitionType } from '../enums/permission.enums';

/**
 * @title RolePermission 实体
 * @description 角色 ↔ 权限分配关系表, 四元组 (role, subject, action, permissionType)。
 *
 *              三种权限类型分别走独立链路, 各自查询互不干扰 ::
 *              - permissionType=Management :: HookAbilityMiddleware / AbilityGuard 查这一类 (CASL 粗粒度)
 *              - permissionType=Data       :: DataPermissionService.applyTo 查这一类 (payload 细粒度收紧)
 *              - permissionType=Menu       :: 前端路由守卫查这一类 (后续扩展)
 *
 *              weight 不存本表, 在 PermissionDefinitionEntity 上 (节点定义自带). 越权防护时 join PermissionDefinition 拿。
 *              旧 conditions 字段已弃用并在迁移中删除。
 * @keywords-cn 权限, 角色权限, 分配关系, 权限类型, 三元生态
 * @keywords-en permission, role-permission, assignment, permission-type, tri-tier
 */
@Entity('role_permissions')
@Index(['roleId'])
@Index(['subject'])
@Index(['action'])
@Index(['permissionType'])
export class RolePermissionEntity extends BaseAuditedEntity {
  @Column({ name: 'role_id', type: 'char', length: 36 })
  roleId!: string;

  @Column({ name: 'subject', type: 'varchar', length: 64 })
  subject!: string;

  @Column({ name: 'action', type: 'varchar', length: 64 })
  action!: string;

  /**
   * 权限类型 :: 默认 management (兼容现存所有 CASL 配置)
   * - management :: 管理权限 (CASL 校验)
   * - data       :: 数据权限 (applyTo 校验)
   * - menu       :: 菜单权限 (前端路由守卫)
   * @keyword-en permission-type
   */
  @Column({
    name: 'permission_type',
    type: 'varchar',
    length: 32,
    default: PermissionDefinitionType.Management,
  })
  permissionType!: PermissionDefinitionType;
}
