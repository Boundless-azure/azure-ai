import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：权限定义类型
 * @description 为 permission_definitions 增加权限类型字段，支持管理/数据/菜单节点分类。
 * @keywords-cn 迁移, 权限定义, 权限类型, 管理节点, 数据节点, 菜单节点
 * @keywords-en migration, permission-definition, permission-type, management-node, data-node, menu-node
 */
export class PermissionDefinitionType1769952000000 implements MigrationInterface {
  name = 'PermissionDefinitionType1769952000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS permission_definitions
      ADD COLUMN IF NOT EXISTS permission_type VARCHAR(32) NOT NULL DEFAULT 'management'
    `);

    await queryRunner.query(`
      UPDATE permission_definitions
      SET permission_type = 'management'
      WHERE permission_type IS NULL OR permission_type = ''
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_perm_def_permission_type
      ON permission_definitions(permission_type)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_perm_def_permission_type
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS permission_definitions
      DROP COLUMN IF EXISTS permission_type
    `);
  }
}
