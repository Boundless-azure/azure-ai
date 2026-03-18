import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：RunnerKeyPlain 兼容补丁
 * @description 为已执行过旧 Runner 迁移的数据库补齐 runner_key_plain 字段。
 * @keywords-cn 迁移补丁, runner_key_plain, 兼容修复
 * @keywords-en migration-patch, runner_key_plain, compatibility-fix
 */
export class RunnerKeyPlainCompat1773300000001 implements MigrationInterface {
  name = 'RunnerKeyPlainCompat1773300000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS runners
      ADD COLUMN IF NOT EXISTS runner_key_plain VARCHAR(128)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS runners
      DROP COLUMN IF EXISTS runner_key_plain
    `);
  }
}
