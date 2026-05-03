import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：RolePermission 加 permission_type, PermissionDefinition 加 weight
 * @description 配合数据权限新范式 ::
 *              - role_permissions :: 删 conditions (旧 CASL 行级条件弃用), 加 permission_type
 *                (默认 'management' 兼容现存 CASL 配置)
 *              - permission_definitions :: 加 weight (节点权重, 用于配置时越权防护)
 *
 *              三种权限类型 (management / data / menu) 通过 permission_type 字段区分,
 *              三条链路各自查询互不干扰。
 * @keywords-cn 迁移, 角色权限类型, 权重, 数据权限, 越权防护
 * @keywords-en migration, role-permission-type, weight, data-permission, escalation-guard
 */
export class RolePermissionTypeAndWeight1774500000000
  implements MigrationInterface
{
  name = 'RolePermissionTypeAndWeight1774500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) role_permissions :: 删 conditions
    await queryRunner.query(
      `ALTER TABLE role_permissions DROP COLUMN IF EXISTS conditions`,
    );
    // 2) role_permissions :: 加 permission_type, 默认 'management' 兼容现存数据
    await queryRunner.query(
      `ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS permission_type VARCHAR(32) NOT NULL DEFAULT 'management'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_rp_permission_type ON role_permissions (permission_type)`,
    );

    // 3) permission_definitions :: 加 weight, 默认 0 (越权防护时 0 表示无权重要求)
    await queryRunner.query(
      `ALTER TABLE permission_definitions ADD COLUMN IF NOT EXISTS weight INTEGER NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE permission_definitions DROP COLUMN IF EXISTS weight`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_rp_permission_type`);
    await queryRunner.query(
      `ALTER TABLE role_permissions DROP COLUMN IF EXISTS permission_type`,
    );
    // 恢复 conditions 列 (空数据, 旧逻辑回滚后无值可填)
    await queryRunner.query(
      `ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS conditions JSON`,
    );
  }
}
