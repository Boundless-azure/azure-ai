import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：AI 模型接口规范
 * @description 为 ai_models 增加 apiProtocol 字段，用于标记接口规范。
 * @keywords-cn 迁移, AI模型, 接口规范
 * @keywords-en migration, ai-model, api-protocol
 */
export class AIModelApiProtocol1773000000000 implements MigrationInterface {
  name = 'AIModelApiProtocol1773000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS ai_models
      ADD COLUMN IF NOT EXISTS "apiProtocol" VARCHAR(50) NOT NULL DEFAULT 'openai'
    `);

    await queryRunner.query(`
      UPDATE ai_models
      SET "apiProtocol" = 'openai'
      WHERE "apiProtocol" IS NULL OR "apiProtocol" = ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS ai_models
      DROP COLUMN IF EXISTS "apiProtocol"
    `);
  }
}
