import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：清理官方 LangGraph checkpoint 旧表
 * @description 删除官方 Postgres saver 遗留的 checkpoint 表；当前系统只使用 lg_checkpoints/lg_writes。
 * @keyword-cn 迁移, 检查点清理, 旧表清理
 * @keyword-en migration, checkpoint-cleanup, official-saver-tables
 */
export class CleanupOfficialCheckpointTables1779609000000 implements MigrationInterface {
  name = 'CleanupOfficialCheckpointTables1779609000000';

  /**
   * 删除官方 saver 遗留表，不影响自定义 TypeORM saver 的 lg_checkpoints/lg_writes。
   * @keyword-en cleanup-official-checkpoints-up, checkpoint-cleanup
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    const obsoleteTables = [
      'checkpoint_writes',
      'checkpoint_blobs',
      'checkpoints',
      'checkpoint_migrations',
    ];

    for (const table of obsoleteTables) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table}`);
    }
  }

  /**
   * 清理迁移不恢复官方 saver 旧表，避免重新引入未使用 schema。
   * @keyword-en cleanup-official-checkpoints-down, rollback-guard
   */
  public async down(_queryRunner: QueryRunner): Promise<void> {
    // no-op: official saver tables are obsolete; lg_checkpoints/lg_writes remain active.
  }
}
