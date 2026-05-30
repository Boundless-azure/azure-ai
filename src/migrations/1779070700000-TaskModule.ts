import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：任务模块
 * @description 创建 tasks 表并建立会话、PM、文件夹路径索引。
 * @keywords-cn 迁移, 任务, tasks, 文件夹
 * @keywords-en migration, task, tasks, folder
 */
export class TaskModule1779070700000 implements MigrationInterface {
  name = 'TaskModule1779070700000';

  /**
   * @title 创建任务表
   * @description 建表并补充常用索引。
   * @keyword-en task-migration-up
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        assigneeids JSONB,
        milestone VARCHAR(255),
        pmid VARCHAR(36),
        folder_path VARCHAR(512),
        session_id VARCHAR(100),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_user VARCHAR(36),
        update_user VARCHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_tasks_session_id ON tasks(session_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_tasks_pmid ON tasks(pmid)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_tasks_folder_path ON tasks(folder_path)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_tasks_is_delete ON tasks(is_delete)`,
    );
  }

  /**
   * @title 删除任务表
   * @description 回滚 tasks 表与索引。
   * @keyword-en task-migration-down
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tasks_is_delete`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tasks_folder_path`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tasks_pmid`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tasks_session_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS tasks`);
  }
}
