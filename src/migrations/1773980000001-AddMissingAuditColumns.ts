import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：添加缺失的审计字段到 todo_followups 表
 * @description 当表已存在但缺少 created_user, update_user, channel_id, is_delete 等审计字段时执行
 * @keywords-cn 迁移, 待办事项, 审计字段, 补全
 * @keywords-en migration, todos, audit columns, fix
 */
export class AddMissingAuditColumns1773980000001 implements MigrationInterface {
  name = 'AddMissingAuditColumns1773980000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 添加审计字段到 todo_followups 表
    await queryRunner.query(`
      ALTER TABLE todo_followups
        ADD COLUMN IF NOT EXISTS created_user VARCHAR(36),
        ADD COLUMN IF NOT EXISTS update_user VARCHAR(36),
        ADD COLUMN IF NOT EXISTS channel_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS is_delete BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP
    `);

    // 添加审计字段到 todo_followup_comments 表
    await queryRunner.query(`
      ALTER TABLE todo_followup_comments
        ADD COLUMN IF NOT EXISTS created_user VARCHAR(36),
        ADD COLUMN IF NOT EXISTS update_user VARCHAR(36),
        ADD COLUMN IF NOT EXISTS channel_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS is_delete BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 回滚 todo_followup_comments 审计字段
    await queryRunner.query(`
      ALTER TABLE todo_followup_comments
        DROP COLUMN IF EXISTS deleted_at,
        DROP COLUMN IF EXISTS updated_at,
        DROP COLUMN IF EXISTS created_at,
        DROP COLUMN IF EXISTS is_delete,
        DROP COLUMN IF EXISTS channel_id,
        DROP COLUMN IF EXISTS update_user,
        DROP COLUMN IF EXISTS created_user
    `);

    // 回滚 todo_followups 审计字段
    await queryRunner.query(`
      ALTER TABLE todo_followups
        DROP COLUMN IF EXISTS deleted_at,
        DROP COLUMN IF EXISTS updated_at,
        DROP COLUMN IF EXISTS created_at,
        DROP COLUMN IF EXISTS is_delete,
        DROP COLUMN IF EXISTS channel_id,
        DROP COLUMN IF EXISTS update_user,
        DROP COLUMN IF EXISTS created_user
    `);
  }
}
