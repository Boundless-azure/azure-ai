import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：LangGraph 模块
 * @description 创建 LangGraph 检查点和写入记录表
 * @keywords-cn 迁移, LangGraph, 检查点, 写入
 * @keywords-en migration, langgraph, checkpoint, write
 */
export class LangGraph1737200000005 implements MigrationInterface {
  name = 'LangGraph1737200000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // lg_checkpoints: LangGraph 检查点表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lg_checkpoints (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        thread_id VARCHAR(255) NOT NULL,
        parent_id CHAR(36),
        checkpoint JSONB NOT NULL,
        metadata JSONB,
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
      `CREATE INDEX IF NOT EXISTS idx_lg_checkpoints_thread ON lg_checkpoints(thread_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_lg_checkpoints_parent ON lg_checkpoints(parent_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_lg_checkpoints_is_delete ON lg_checkpoints(is_delete)`,
    );

    // lg_writes: LangGraph 写入记录表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lg_writes (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        thread_id VARCHAR(255) NOT NULL,
        checkpoint_id CHAR(36) NOT NULL,
        task_id VARCHAR(255) NOT NULL,
        idx INT NOT NULL,
        channel VARCHAR(255) NOT NULL,
        value JSONB,
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
      `CREATE INDEX IF NOT EXISTS idx_lg_writes_thread ON lg_writes(thread_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_lg_writes_checkpoint ON lg_writes(checkpoint_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_lg_writes_task ON lg_writes(task_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_lg_writes_is_delete ON lg_writes(is_delete)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS lg_writes`);
    await queryRunner.query(`DROP TABLE IF EXISTS lg_checkpoints`);
  }
}
