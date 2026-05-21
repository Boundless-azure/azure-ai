import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：固定 ID 字段改用 VARCHAR
 * @description 将现有 CHAR(36) 标识字段转换为 VARCHAR(36), 并清理定长字段遗留的右侧空格。
 * @keyword-cn 迁移, 固定标识, 可变长度
 * @keyword-en migration, fixed-id, varchar-id
 */
export class UseVarcharForFixedIds1779070600000 implements MigrationInterface {
  name = 'UseVarcharForFixedIds1779070600000';

  /**
   * 将 PostgreSQL 当前 schema 下的 CHAR(36) 字段转换为 VARCHAR(36)。
   * @keyword-cn 固定标识, 可变长度, 清理空格
   * @keyword-en fixed-id, varchar-id, trim-padding
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }

    await queryRunner.query(`
      DO $$
      DECLARE
        target_column record;
      BEGIN
        ALTER TABLE IF EXISTS agent_executions DROP CONSTRAINT IF EXISTS fk_agent_exec_agent;
        ALTER TABLE IF EXISTS app_units DROP CONSTRAINT IF EXISTS fk_app_units_app;
        ALTER TABLE IF EXISTS solution_purchases DROP CONSTRAINT IF EXISTS fk_solution_purchases_user;

        FOR target_column IN
          SELECT c.table_schema, c.table_name, c.column_name
          FROM information_schema.columns c
          JOIN information_schema.tables t
            ON t.table_schema = c.table_schema
           AND t.table_name = c.table_name
          WHERE c.table_schema = current_schema()
            AND t.table_type = 'BASE TABLE'
            AND c.data_type = 'character'
            AND c.character_maximum_length = 36
          ORDER BY c.table_schema, c.table_name, c.ordinal_position
        LOOP
          EXECUTE format(
            'ALTER TABLE %I.%I ALTER COLUMN %I TYPE VARCHAR(36) USING rtrim(%I::text)',
            target_column.table_schema,
            target_column.table_name,
            target_column.column_name,
            target_column.column_name
          );
        END LOOP;

        IF to_regclass('agent_executions') IS NOT NULL
          AND to_regclass('agents') IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'fk_agent_exec_agent'
              AND conrelid = to_regclass('agent_executions')
          )
        THEN
          ALTER TABLE agent_executions
            ADD CONSTRAINT fk_agent_exec_agent
            FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
        END IF;

        IF to_regclass('app_units') IS NOT NULL
          AND to_regclass('apps') IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'fk_app_units_app'
              AND conrelid = to_regclass('app_units')
          )
        THEN
          ALTER TABLE app_units
            ADD CONSTRAINT fk_app_units_app
            FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE;
        END IF;

        IF to_regclass('solution_purchases') IS NOT NULL
          AND to_regclass('users') IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'fk_solution_purchases_user'
              AND conrelid = to_regclass('solution_purchases')
          )
        THEN
          ALTER TABLE solution_purchases
            ADD CONSTRAINT fk_solution_purchases_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);
  }

  /**
   * 保留 VARCHAR(36) 定义, 避免回滚重新引入 CHAR padding。
   * @keyword-cn 固定标识, 可变长度, 回滚保护
   * @keyword-en fixed-id, varchar-id, rollback-guard
   */
  public async down(_queryRunner: QueryRunner): Promise<void> {
    return;
  }
}
