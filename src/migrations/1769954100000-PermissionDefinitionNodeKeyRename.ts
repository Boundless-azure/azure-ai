import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：权限定义节点键字段重命名
 * @description 将 permission_definitions.name 统一重命名为 node_key。
 * @keywords-cn 迁移, 权限定义, 字段重命名, 节点键
 * @keywords-en migration, permission-definition, rename-column, node-key
 */
export class PermissionDefinitionNodeKeyRename1769954100000 implements MigrationInterface {
  name = 'PermissionDefinitionNodeKeyRename1769954100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS permission_definitions
      ADD COLUMN IF NOT EXISTS node_key VARCHAR(64) NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'permission_definitions'
            AND column_name = 'name'
        ) THEN
          UPDATE permission_definitions
          SET node_key = name
          WHERE node_key IS NULL
            AND name IS NOT NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_perm_def_name
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_perm_def_node_key
      ON permission_definitions(node_key)
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS permission_definitions
      ALTER COLUMN node_key SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS permission_definitions
      DROP COLUMN IF EXISTS name
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS permission_definitions
      ADD COLUMN IF NOT EXISTS name VARCHAR(64) NULL
    `);

    await queryRunner.query(`
      UPDATE permission_definitions
      SET name = node_key
      WHERE name IS NULL
        AND node_key IS NOT NULL
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_perm_def_node_key
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_perm_def_name
      ON permission_definitions(name)
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS permission_definitions
      DROP COLUMN IF EXISTS node_key
    `);
  }
}
