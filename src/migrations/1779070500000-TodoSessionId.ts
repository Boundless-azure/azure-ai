import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：待办关联会话
 * @description 为 todos 表增加可选 session_id 字段，用于对话窗口待办按会话读取。
 * @keywords-cn 迁移, todos, session_id, 聊天待办
 * @keywords-en migration, todos, session-id, chat-todos
 */
export class TodoSessionId1779070500000 implements MigrationInterface {
  name = 'TodoSessionId1779070500000';

  /**
   * 增加 todos.session_id 与索引。
   * @keyword-en todo-session-id-up
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE todos ADD COLUMN IF NOT EXISTS session_id VARCHAR(100)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_todos_session_id ON todos(session_id)`,
    );
  }

  /**
   * 移除 todos.session_id 与索引。
   * @keyword-en todo-session-id-down
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_todos_session_id`);
    await queryRunner.query(`ALTER TABLE todos DROP COLUMN IF EXISTS session_id`);
  }
}
