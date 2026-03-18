import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：Runner 与关联字段
 * @description 新增 runners 表，并为 apps、app_units、agent_executions 增加 runner_id。
 * @keywords-cn 迁移, runner, 注册, runner_id, 关联
 * @keywords-en migration, runner, registration, runner_id, relation
 */
export class Runners1773300000000 implements MigrationInterface {
  name = 'Runners1773300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS runners (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        alias VARCHAR(120) NOT NULL,
        runner_key_hash VARCHAR(128) NOT NULL,
        runner_key_plain VARCHAR(128) NOT NULL,
        principal_id CHAR(36) NOT NULL,
        description TEXT,
        status VARCHAR(32) NOT NULL DEFAULT 'offline',
        last_seen_at TIMESTAMPTZ,
        active BOOLEAN NOT NULL DEFAULT TRUE,
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
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_runners_alias ON runners(alias)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_runners_principal_id ON runners(principal_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_runners_status ON runners(status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_runners_is_delete ON runners(is_delete)`,
    );
    await queryRunner.query(`
      ALTER TABLE IF EXISTS runners
      ADD COLUMN IF NOT EXISTS runner_key_plain VARCHAR(128)
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS apps
      ADD COLUMN IF NOT EXISTS runner_id CHAR(36)
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS app_units
      ADD COLUMN IF NOT EXISTS runner_id CHAR(36)
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS agent_executions
      ADD COLUMN IF NOT EXISTS runner_id CHAR(36)
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_apps_runner_id ON apps(runner_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_app_units_runner_id ON app_units(runner_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_agent_executions_runner_id ON agent_executions(runner_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_agent_executions_runner_id`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_app_units_runner_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_apps_runner_id`);
    await queryRunner.query(
      `ALTER TABLE IF EXISTS agent_executions DROP COLUMN IF EXISTS runner_id`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS app_units DROP COLUMN IF EXISTS runner_id`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS apps DROP COLUMN IF EXISTS runner_id`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS runners`);
  }
}
