import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：Agent 知识分配表
 * @description 新增 agent_knowledge_assignments 表，用于保存 Agent 与数据库知识书本的自定义绑定关系。
 * @keywords-cn 迁移, Agent知识分配, 关系表
 * @keywords-en migration, agent-knowledge-assignment, relation-table
 */
export class AgentKnowledgeAssignments1779601000000
  implements MigrationInterface
{
  name = 'AgentKnowledgeAssignments1779601000000';

  /**
   * @title 执行迁移
   * @description 创建 Agent 知识分配表及查询索引。
   * @keyword-en agent-knowledge-assignments-up
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS agent_knowledge_assignments (
        id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        agent_id VARCHAR(36) NOT NULL,
        book_id VARCHAR(100) NOT NULL,
        created_user VARCHAR(36),
        update_user VARCHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_agent_knowledge_assignments_agent_id ON agent_knowledge_assignments(agent_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_agent_knowledge_assignments_book_id ON agent_knowledge_assignments(book_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_agent_knowledge_assignments_is_delete ON agent_knowledge_assignments(is_delete)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_knowledge_assignments_agent_book_active ON agent_knowledge_assignments(agent_id, book_id, is_delete)`,
    );
  }

  /**
   * @title 回滚迁移
   * @description 删除 Agent 知识分配表及关联索引。
   * @keyword-en agent-knowledge-assignments-down
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS uq_agent_knowledge_assignments_agent_book_active`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_agent_knowledge_assignments_is_delete`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_agent_knowledge_assignments_book_id`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_agent_knowledge_assignments_agent_id`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS agent_knowledge_assignments`);
  }
}
