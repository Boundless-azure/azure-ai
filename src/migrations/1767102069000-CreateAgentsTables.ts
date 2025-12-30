import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAgentsTables1767102069000 implements MigrationInterface {
  name = 'CreateAgentsTables1767102069000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id CHAR(36) PRIMARY KEY,
        code_dir VARCHAR(255) NOT NULL,
        nickname VARCHAR(100) NOT NULL,
        is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
        purpose TEXT NULL,
        embedding JSONB NULL,
        vector_ref VARCHAR(200) NULL,
        nodes JSONB NULL,
        conversation_group_id CHAR(36) NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_user CHAR(36) NULL,
        update_user CHAR(36) NULL,
        channel_id VARCHAR(100) NULL,
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ NULL
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_agents_code_dir ON agents (code_dir)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_agents_conv_group ON agents (conversation_group_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_agents_is_delete ON agents (is_delete)',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS agent_executions (
        id CHAR(36) PRIMARY KEY,
        agent_id CHAR(36) NOT NULL,
        task_description TEXT NOT NULL,
        node_status JSONB NULL,
        latest_response JSONB NULL,
        context_message_id CHAR(36) NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_user CHAR(36) NULL,
        update_user CHAR(36) NULL,
        channel_id VARCHAR(100) NULL,
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ NULL,
        CONSTRAINT fk_agent_exec_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_agent_exec_agent ON agent_executions (agent_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_agent_exec_ctx_msg ON agent_executions (context_message_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_agent_exec_is_delete ON agent_executions (is_delete)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS agent_executions');
    await queryRunner.query('DROP TABLE IF EXISTS agents');
  }
}
