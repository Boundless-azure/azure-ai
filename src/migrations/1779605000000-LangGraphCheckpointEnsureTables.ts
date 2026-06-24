import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：确保自定义 LangGraph Checkpoint 表存在
 * @description 为已经执行过旧补列迁移但目标库仍缺表的环境补建自定义 checkpoint 表。
 * @keywords-cn 迁移, LangGraph, Checkpoint, 自定义保存器
 * @keywords-en migration, langgraph-checkpoint, custom-saver, ensure-tables
 * @keyword-cn 迁移, 检查点表结构, 自定义保存器
 * @keyword-en migration, langgraph-checkpoint, custom-saver, ensure-tables
 */
export class LangGraphCheckpointEnsureTables1779605000000 implements MigrationInterface {
  name = 'LangGraphCheckpointEnsureTables1779605000000';

  /**
   * 创建缺失的 checkpoint/write 表，并补齐自定义 saver 字段和索引。
   * @keyword-en langgraph-checkpoint, custom-saver, ensure-tables
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lg_checkpoints (
        id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        thread_id VARCHAR(100) NOT NULL,
        checkpoint_ns VARCHAR(100) NOT NULL DEFAULT 'default',
        checkpoint_id VARCHAR(128) NOT NULL,
        session_id VARCHAR(100),
        agent_id VARCHAR(36),
        agent_principal_id VARCHAR(36),
        ai_model_ids JSONB,
        checkpoint_json TEXT NOT NULL,
        metadata_json JSONB,
        parents_json JSONB,
        created_user VARCHAR(36),
        update_user VARCHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      ALTER TABLE lg_checkpoints
        ADD COLUMN IF NOT EXISTS checkpoint_ns VARCHAR(100) NOT NULL DEFAULT 'default',
        ADD COLUMN IF NOT EXISTS checkpoint_id VARCHAR(128),
        ADD COLUMN IF NOT EXISTS session_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS agent_id VARCHAR(36),
        ADD COLUMN IF NOT EXISTS agent_principal_id VARCHAR(36),
        ADD COLUMN IF NOT EXISTS ai_model_ids JSONB,
        ADD COLUMN IF NOT EXISTS checkpoint_json TEXT,
        ADD COLUMN IF NOT EXISTS metadata_json JSONB,
        ADD COLUMN IF NOT EXISTS parents_json JSONB
    `);

    const hasOldCheckpoint = await queryRunner.hasColumn(
      'lg_checkpoints',
      'checkpoint',
    );
    const hasOldMetadata = await queryRunner.hasColumn(
      'lg_checkpoints',
      'metadata',
    );
    const checkpointIdExpr = hasOldCheckpoint
      ? `COALESCE(checkpoint_id, checkpoint ->> 'id', id)`
      : `COALESCE(checkpoint_id, id)`;
    const checkpointJsonExpr = hasOldCheckpoint
      ? `COALESCE(checkpoint_json, checkpoint::text)`
      : `COALESCE(
          checkpoint_json,
          jsonb_build_object(
            'v', 1,
            'id', id,
            'ts', created_at,
            'channel_values', jsonb_build_object(),
            'channel_versions', jsonb_build_object(),
            'versions_seen', jsonb_build_object()
          )::text
        )`;
    const metadataJsonExpr = hasOldMetadata
      ? `COALESCE(metadata_json, metadata)`
      : `COALESCE(metadata_json, '{}'::jsonb)`;

    await queryRunner.query(`
      UPDATE lg_checkpoints
      SET
        checkpoint_id = ${checkpointIdExpr},
        checkpoint_json = ${checkpointJsonExpr},
        metadata_json = ${metadataJsonExpr},
        parents_json = COALESCE(parents_json, '{}'::jsonb)
      WHERE checkpoint_id IS NULL
         OR checkpoint_json IS NULL
         OR metadata_json IS NULL
         OR parents_json IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE lg_checkpoints
        ALTER COLUMN checkpoint_id SET NOT NULL,
        ALTER COLUMN checkpoint_json SET NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_lg_checkpoints_thread_ns
        ON lg_checkpoints(thread_id, checkpoint_ns)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_lg_checkpoints_thread_ns_id
        ON lg_checkpoints(thread_id, checkpoint_ns, checkpoint_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_lg_checkpoints_session
        ON lg_checkpoints(session_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_lg_checkpoints_agent
        ON lg_checkpoints(agent_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lg_writes (
        id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        thread_id VARCHAR(100) NOT NULL,
        checkpoint_ns VARCHAR(100) NOT NULL DEFAULT 'default',
        checkpoint_id VARCHAR(128) NOT NULL,
        session_id VARCHAR(100),
        agent_id VARCHAR(36),
        agent_principal_id VARCHAR(36),
        ai_model_ids JSONB,
        task_id VARCHAR(128) NOT NULL,
        idx INT NOT NULL,
        channel VARCHAR(128) NOT NULL,
        value_type VARCHAR(128) NOT NULL,
        value_b64 TEXT NOT NULL,
        created_user VARCHAR(36),
        update_user VARCHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      ALTER TABLE lg_writes
        ADD COLUMN IF NOT EXISTS checkpoint_ns VARCHAR(100) NOT NULL DEFAULT 'default',
        ADD COLUMN IF NOT EXISTS session_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS agent_id VARCHAR(36),
        ADD COLUMN IF NOT EXISTS agent_principal_id VARCHAR(36),
        ADD COLUMN IF NOT EXISTS ai_model_ids JSONB,
        ADD COLUMN IF NOT EXISTS value_type VARCHAR(128),
        ADD COLUMN IF NOT EXISTS value_b64 TEXT
    `);

    const hasOldWriteValue = await queryRunner.hasColumn('lg_writes', 'value');
    const valueB64Expr = hasOldWriteValue
      ? `COALESCE(
          value_b64,
          encode(convert_to(COALESCE(value::text, 'null'), 'UTF8'), 'base64')
        )`
      : `COALESCE(value_b64, encode(convert_to('null', 'UTF8'), 'base64'))`;

    await queryRunner.query(`
      UPDATE lg_writes
      SET
        value_type = COALESCE(value_type, 'json'),
        value_b64 = ${valueB64Expr}
      WHERE value_type IS NULL
         OR value_b64 IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE lg_writes
        ALTER COLUMN value_type SET NOT NULL,
        ALTER COLUMN value_b64 SET NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_lg_writes_thread_ns
        ON lg_writes(thread_id, checkpoint_ns)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_lg_writes_thread_ns_checkpoint
        ON lg_writes(thread_id, checkpoint_ns, checkpoint_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_lg_writes_session
        ON lg_writes(session_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_lg_writes_agent
        ON lg_writes(agent_id)
    `);
  }

  /**
   * 补救迁移不删除 checkpoint 数据，避免回滚时丢失工作流状态。
   * @keyword-en langgraph-checkpoint, custom-saver, rollback-guard
   */
  public async down(_queryRunner: QueryRunner): Promise<void> {
    return;
  }
}
