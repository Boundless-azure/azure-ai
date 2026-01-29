import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：Agent 模块
 * @description 创建 Agent 和执行记录表
 * @keywords-cn 迁移, Agent, 智能体, 执行
 * @keywords-en migration, agent, execution
 */
export class Agent1737200000004 implements MigrationInterface {
  name = 'Agent1737200000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // agents: Agent 元信息表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        code_dir VARCHAR(255) NOT NULL,
        nickname VARCHAR(100) NOT NULL,
        is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
        purpose TEXT,
        embedding vector(1536),
        keywords JSONB,
        nodes JSONB,
        principal_id CHAR(36),
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
      `CREATE INDEX IF NOT EXISTS idx_agents_code_dir ON agents(code_dir)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_agents_principal_id ON agents(principal_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_agents_is_delete ON agents(is_delete)`,
    );

    // agent_executions: Agent 执行记录表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS agent_executions (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        agent_id CHAR(36) NOT NULL,
        task_description TEXT NOT NULL,
        node_status JSONB,
        latest_response JSONB,
        context_message_id CHAR(36),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ,
        CONSTRAINT fk_agent_exec_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_agent_exec_agent ON agent_executions(agent_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_agent_exec_ctx_msg ON agent_executions(context_message_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_agent_exec_is_delete ON agent_executions(is_delete)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS agent_executions`);
    await queryRunner.query(`DROP TABLE IF EXISTS agents`);
  }
}
