import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：插件表 runner_id 改为 runner_ids
 * @description 将 runner_id 单个字段改为 runner_ids JSON 数组，支持多 Runner 安装
 * @keywords-cn 迁移, 插件, runner_ids
 * @keywords-en migration, plugin, runner_ids
 */
export class PluginRunnerIds1773950000000 implements MigrationInterface {
  name = 'PluginRunnerIds1773950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old runner_id column if it exists
    await queryRunner.query(`
      ALTER TABLE "plugins" DROP COLUMN IF EXISTS "runner_id"
    `);

    // Add runner_ids as json column
    await queryRunner.query(`
      ALTER TABLE "plugins" ADD COLUMN IF NOT EXISTS "runner_ids" json
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "plugins" DROP COLUMN IF EXISTS "runner_ids"
    `);

    await queryRunner.query(`
      ALTER TABLE "plugins" ADD COLUMN IF NOT EXISTS "runner_id" char(36)
    `);
  }
}
