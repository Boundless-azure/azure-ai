import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：重建默认AI模型
 * @description 清理历史默认模型并重建 OpenAI 与 Gemini 默认项（不含API Key）。
 * @keywords-cn 迁移, 默认模型, OpenAI, Gemini
 * @keywords-en migration, default-models, openai, gemini
 */
export class ResetDefaultAIModels1773200000001 implements MigrationInterface {
  name = 'ResetDefaultAIModels1773200000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE ai_models
      SET is_delete = TRUE, deleted_at = CURRENT_TIMESTAMP
      WHERE is_delete = FALSE
    `);

    await queryRunner.query(`
      INSERT INTO ai_models
      (id, name, "displayName", provider, "apiProtocol", type, status, "apiKey", "baseURL", enabled, created_at, updated_at, is_delete)
      VALUES
      (uuid_generate_v7()::text, 'gpt-4o-mini', 'OpenAI GPT-4o Mini', 'openai', 'openai', 'chat', 'active', '', NULL, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE),
      (uuid_generate_v7()::text, 'gemini-1.5-pro', 'Google Gemini 1.5 Pro', 'gemini', 'openai', 'chat', 'active', '', NULL, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM ai_models
      WHERE name IN ('gpt-4o-mini', 'gemini-1.5-pro')
    `);
  }
}
