import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：Agent模型ID配置
 * @description 为 agents 增加 ai_model_ids 字段。
 * @keywords-cn 迁移, Agent, 模型ID, 多选
 * @keywords-en migration, agent, model-ids, multi-select
 */
export class AgentProviders1773200000000 implements MigrationInterface {
  name = 'AgentProviders1773200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS agents
      ADD COLUMN IF NOT EXISTS ai_model_ids JSONB
    `);
    await queryRunner.query(`
      UPDATE agents
      SET ai_model_ids = '[]'::jsonb
      WHERE ai_model_ids IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS agents
      DROP COLUMN IF EXISTS ai_providers
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS agents
      DROP COLUMN IF EXISTS llm_provider_index
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS agents
      DROP COLUMN IF EXISTS ai_model_ids
    `);
  }
}
