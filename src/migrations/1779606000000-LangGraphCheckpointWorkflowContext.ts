import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：补齐 LangGraph Checkpoint 工作流上下文
 * @description 为自定义 checkpoint 表增加 session/agent/model 追踪字段，避免 thread_id 被误当会话上下文。
 * @keywords-cn 迁移, LangGraph, Checkpoint, 工作流上下文
 * @keywords-en migration, langgraph-checkpoint, workflow-context, agent-link
 * @keyword-cn 迁移, 检查点, 工作流上下文
 * @keyword-en migration, langgraph-checkpoint, workflow-context, agent-link
 */
export class LangGraphCheckpointWorkflowContext1779606000000 implements MigrationInterface {
  name = 'LangGraphCheckpointWorkflowContext1779606000000';

  /**
   * 为 checkpoint/write 表补充 session、agent 与模型 ID 快照字段。
   * @keyword-en langgraph-checkpoint, workflow-context, agent-link
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;

    await queryRunner.query(`
      ALTER TABLE lg_checkpoints
        ADD COLUMN IF NOT EXISTS session_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS agent_id VARCHAR(36),
        ADD COLUMN IF NOT EXISTS agent_principal_id VARCHAR(36),
        ADD COLUMN IF NOT EXISTS ai_model_ids JSONB
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
      ALTER TABLE lg_writes
        ADD COLUMN IF NOT EXISTS session_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS agent_id VARCHAR(36),
        ADD COLUMN IF NOT EXISTS agent_principal_id VARCHAR(36),
        ADD COLUMN IF NOT EXISTS ai_model_ids JSONB
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
   * 回滚 checkpoint/write 表的 workflow 上下文字段。
   * @keyword-en langgraph-checkpoint, workflow-context, rollback
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;

    await queryRunner.query(`DROP INDEX IF EXISTS idx_lg_writes_agent`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_lg_writes_session`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_lg_checkpoints_agent`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_lg_checkpoints_session`);

    await queryRunner.query(`
      ALTER TABLE lg_writes
        DROP COLUMN IF EXISTS ai_model_ids,
        DROP COLUMN IF EXISTS agent_principal_id,
        DROP COLUMN IF EXISTS agent_id,
        DROP COLUMN IF EXISTS session_id
    `);
    await queryRunner.query(`
      ALTER TABLE lg_checkpoints
        DROP COLUMN IF EXISTS ai_model_ids,
        DROP COLUMN IF EXISTS agent_principal_id,
        DROP COLUMN IF EXISTS agent_id,
        DROP COLUMN IF EXISTS session_id
    `);
  }
}
