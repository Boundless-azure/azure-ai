import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：权限定义树模型
 * @description 将 permission_definitions 从 subject/action 结构迁移为 fid/node_key/extra_data 树结构。
 * @keywords-cn 迁移, 权限定义, 树模型, 父子结构
 * @keywords-en migration, permission-definition, tree-model, parent-child
 */
export class PermissionDefinitionTreeModel1769954000000 implements MigrationInterface {
  name = 'PermissionDefinitionTreeModel1769954000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS permission_definitions
      ADD COLUMN IF NOT EXISTS fid CHAR(36) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS permission_definitions
      ADD COLUMN IF NOT EXISTS node_key VARCHAR(64) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS permission_definitions
      ADD COLUMN IF NOT EXISTS extra_data JSONB NULL
    `);

    await queryRunner.query(`
      INSERT INTO permission_definitions (
        id, fid, node_key, extra_data, permission_type, description, subject, action,
        created_user, update_user, channel_id, is_delete, created_at, updated_at, deleted_at
      )
      SELECT
        uuid_generate_v7()::text,
        NULL,
        src.subject,
        NULL,
        src.permission_type,
        src.subject_description,
        src.subject,
        src.subject,
        NULL,
        NULL,
        NULL,
        FALSE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        NULL
      FROM (
        SELECT
          subject,
          permission_type,
          MAX(subject_description) AS subject_description
        FROM permission_definitions
        WHERE subject IS NOT NULL
          AND subject <> ''
          AND is_delete = FALSE
        GROUP BY subject, permission_type
      ) AS src
      WHERE NOT EXISTS (
        SELECT 1
        FROM permission_definitions p
        WHERE p.fid IS NULL
          AND p.node_key = src.subject
          AND p.permission_type = src.permission_type
          AND p.is_delete = FALSE
      )
    `);

    await queryRunner.query(`
      UPDATE permission_definitions c
      SET
        fid = p.id,
        node_key = COALESCE(NULLIF(c.action, ''), c.node_key),
        extra_data = COALESCE(c.extra_data, '{}'::jsonb)
      FROM permission_definitions p
      WHERE c.subject IS NOT NULL
        AND c.action IS NOT NULL
        AND c.node_key IS NULL
        AND c.is_delete = FALSE
        AND p.fid IS NULL
        AND p.node_key = c.subject
        AND p.permission_type = c.permission_type
    `);

    await queryRunner.query(`
      UPDATE permission_definitions
      SET node_key = id
      WHERE node_key IS NULL OR node_key = ''
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_perm_def_subject
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_perm_def_action
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_perm_def_permission_type
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_perm_def_fid
      ON permission_definitions(fid)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_perm_def_node_key
      ON permission_definitions(node_key)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_perm_def_permission_type
      ON permission_definitions(permission_type)
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS permission_definitions
      ALTER COLUMN node_key SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS permission_definitions
      DROP COLUMN IF EXISTS subject
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS permission_definitions
      DROP COLUMN IF EXISTS action
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS permission_definitions
      DROP COLUMN IF EXISTS subject_description
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS permission_definitions
      ADD COLUMN IF NOT EXISTS subject VARCHAR(64) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS permission_definitions
      ADD COLUMN IF NOT EXISTS action VARCHAR(64) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS permission_definitions
      ADD COLUMN IF NOT EXISTS subject_description TEXT NULL
    `);

    await queryRunner.query(`
      UPDATE permission_definitions c
      SET
        subject = p.node_key,
        action = c.node_key,
        subject_description = p.description
      FROM permission_definitions p
      WHERE c.fid = p.id
    `);

    await queryRunner.query(`
      DELETE FROM permission_definitions
      WHERE fid IS NULL
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_perm_def_fid
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_perm_def_node_key
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_perm_def_permission_type
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_perm_def_subject
      ON permission_definitions(subject)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_perm_def_action
      ON permission_definitions(action)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_perm_def_permission_type
      ON permission_definitions(permission_type)
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS permission_definitions
      DROP COLUMN IF EXISTS fid
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS permission_definitions
      DROP COLUMN IF EXISTS node_key
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS permission_definitions
      DROP COLUMN IF EXISTS extra_data
    `);
  }
}
