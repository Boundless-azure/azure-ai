import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：Agent模型ID兼容修复
 * @description 补充 ai_model_ids 字段，并在存在 ai_providers 时回填模型ID列表。
 * @keywords-cn 迁移, Agent, 模型ID, 兼容修复
 * @keywords-en migration, agent, model-id, compatibility
 */
export class AgentModelIdsCompat1773200000002 implements MigrationInterface {
  name = 'AgentModelIdsCompat1773200000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS agents
      ADD COLUMN IF NOT EXISTS ai_model_ids JSONB
    `);
    await queryRunner.query(`
      UPDATE agents
      SET ai_model_ids = COALESCE(ai_model_ids, '[]'::jsonb)
      WHERE ai_model_ids IS NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'agents' AND column_name = 'ai_providers'
        ) THEN
          UPDATE agents
          SET ai_model_ids = ai_providers
          WHERE (
            ai_model_ids IS NULL OR ai_model_ids = '[]'::jsonb
          ) AND ai_providers IS NOT NULL;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS agents
      DROP COLUMN IF EXISTS ai_model_ids
    `);
  }
}
