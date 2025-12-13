import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLangGraphCheckpointTables1765600000000 implements MigrationInterface {
  name = 'CreateLangGraphCheckpointTables1765600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lg_checkpoints (
        id CHAR(36) NOT NULL PRIMARY KEY,
        thread_id VARCHAR(100) NOT NULL,
        checkpoint_ns VARCHAR(100) NOT NULL DEFAULT 'default',
        checkpoint_id VARCHAR(128) NOT NULL,
        checkpoint_json TEXT NOT NULL,
        metadata_json JSONB NULL,
        parents_json JSONB NULL,
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ,
        CONSTRAINT "UQ_LG_THREAD_NS_ID" UNIQUE (thread_id, checkpoint_ns, checkpoint_id)
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_lg_ckpt_thread ON lg_checkpoints (thread_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_lg_ckpt_thread_ns ON lg_checkpoints (thread_id, checkpoint_ns)',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lg_writes (
        id CHAR(36) NOT NULL PRIMARY KEY,
        thread_id VARCHAR(100) NOT NULL,
        checkpoint_ns VARCHAR(100) NOT NULL DEFAULT 'default',
        checkpoint_id VARCHAR(128) NOT NULL,
        task_id VARCHAR(128) NOT NULL,
        idx INT NOT NULL,
        channel VARCHAR(128) NOT NULL,
        value_type VARCHAR(128) NOT NULL,
        value_b64 TEXT NOT NULL,
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
      'CREATE INDEX IF NOT EXISTS idx_lg_write_thread ON lg_writes (thread_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_lg_write_thread_ns ON lg_writes (thread_id, checkpoint_ns)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_lg_write_thread_ns_ckpt ON lg_writes (thread_id, checkpoint_ns, checkpoint_id)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS lg_writes');
    await queryRunner.query('DROP TABLE IF EXISTS lg_checkpoints');
  }
}
