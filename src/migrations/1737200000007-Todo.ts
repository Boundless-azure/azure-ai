import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：待办事项模块
 * @description 创建待办事项表
 * @keywords-cn 迁移, 待办, 任务
 * @keywords-en migration, todo, task
 */
export class Todo1737200000007 implements MigrationInterface {
  name = 'Todo1737200000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // todos: 待办事项表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        priority INT DEFAULT 0,
        due_date TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        assignee_id CHAR(36),
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_todos_assignee ON todos(assignee_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_todos_is_delete ON todos(is_delete)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS todos`);
  }
}
