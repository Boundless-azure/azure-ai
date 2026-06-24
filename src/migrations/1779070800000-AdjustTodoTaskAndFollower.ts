import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：调整待办任务关联与跟进人
 * @description 为 todos 表增加 task_id 与 followerid，并从 followerids 回填单选跟进人。
 * @keywords-cn 迁移, 待办, 任务关联, 单选跟进人
 * @keywords-en migration, todo, task-link, single-follower
 */
export class AdjustTodoTaskAndFollower1779070800000 implements MigrationInterface {
  name = 'AdjustTodoTaskAndFollower1779070800000';

  /**
   * @title 执行迁移
   * @description 新增字段、回填数据并创建索引。
   * @keyword-en adjust-todo-up
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE todos ADD COLUMN IF NOT EXISTS task_id VARCHAR(36)`,
    );
    await queryRunner.query(
      `ALTER TABLE todos ADD COLUMN IF NOT EXISTS followerid VARCHAR(36)`,
    );
    await queryRunner.query(`
      UPDATE todos
      SET followerid = COALESCE(
        followerid,
        CASE
          WHEN followerids IS NULL THEN NULL
          WHEN jsonb_typeof(followerids::jsonb) = 'array'
            AND jsonb_array_length(followerids::jsonb) > 0
          THEN followerids::jsonb ->> 0
          ELSE NULL
        END
      )
      WHERE is_delete = false
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_todos_task_id ON todos(task_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_todos_followerid ON todos(followerid)`,
    );
  }

  /**
   * @title 回滚迁移
   * @description 删除新增字段与索引。
   * @keyword-en adjust-todo-down
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_todos_followerid`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_todos_task_id`);
    await queryRunner.query(
      `ALTER TABLE todos DROP COLUMN IF EXISTS followerid`,
    );
    await queryRunner.query(`ALTER TABLE todos DROP COLUMN IF EXISTS task_id`);
  }
}
