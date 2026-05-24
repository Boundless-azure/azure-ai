import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：Agent 主动对话字段
 * @description 为 agents 表增加 proactive_chat_enabled 字段，默认 true。
 * @keywords-cn 迁移, Agent, 主动对话, 字段新增
 * @keywords-en migration, agent, proactive-chat, add-column
 */
export class AgentProactiveChat1774200000001 implements MigrationInterface {
  name = 'AgentProactiveChat1774200000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS agents
      ADD COLUMN IF NOT EXISTS proactive_chat_enabled BOOLEAN NOT NULL DEFAULT TRUE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE agents DROP COLUMN IF EXISTS proactive_chat_enabled
    `);
  }
}
