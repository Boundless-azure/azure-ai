import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：补齐自定义 LangGraph Checkpoint 表结构
 * @description 将早期 lg_checkpoints/lg_writes 表升级为 TypeOrmCheckpointSaver 当前实体字段。
 * @keywords-cn 迁移, LangGraph, Checkpoint, 自定义保存器
 * @keywords-en migration, langgraph-checkpoint, custom-saver, schema-align
 * @keyword-cn 迁移, 检查点表结构, 自定义保存器
 * @keyword-en migration, langgraph-checkpoint, custom-saver, schema-align
 */
export class LangGraphCheckpointCustomSchema1779604000000 implements MigrationInterface {
  name = 'LangGraphCheckpointCustomSchema1779604000000';

  /**
   * 补齐 checkpoint_ns、checkpoint_json 等自定义 saver 字段。
   * @keyword-en langgraph-checkpoint, custom-saver, schema-align
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
        parents_json = COALESCE(
          parents_json,
          '{}'::jsonb
        )
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
   * 回滚自定义 saver 新增字段。
   * @keyword-en langgraph-checkpoint, custom-saver, rollback
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;

    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_lg_writes_thread_ns_checkpoint`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_lg_writes_agent`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_lg_writes_session`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_lg_writes_thread_ns`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_lg_checkpoints_thread_ns_id`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_lg_checkpoints_agent`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_lg_checkpoints_session`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_lg_checkpoints_thread_ns`,
    );

    await queryRunner.query(`
      ALTER TABLE lg_writes
        DROP COLUMN IF EXISTS value_b64,
        DROP COLUMN IF EXISTS value_type,
        DROP COLUMN IF EXISTS ai_model_ids,
        DROP COLUMN IF EXISTS agent_principal_id,
        DROP COLUMN IF EXISTS agent_id,
        DROP COLUMN IF EXISTS session_id,
        DROP COLUMN IF EXISTS checkpoint_ns
    `);

    await queryRunner.query(`
      ALTER TABLE lg_checkpoints
        DROP COLUMN IF EXISTS parents_json,
        DROP COLUMN IF EXISTS metadata_json,
        DROP COLUMN IF EXISTS checkpoint_json,
        DROP COLUMN IF EXISTS ai_model_ids,
        DROP COLUMN IF EXISTS agent_principal_id,
        DROP COLUMN IF EXISTS agent_id,
        DROP COLUMN IF EXISTS session_id,
        DROP COLUMN IF EXISTS checkpoint_id,
        DROP COLUMN IF EXISTS checkpoint_ns
    `);
  }
}
