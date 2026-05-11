import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移: ai_models 加 thinking_enabled 独立 column
 * @description 思考模式开关从 defaultParams JSON 内提到独立 boolean 列, 便于 SQL 过滤 / 索引 / schema 清晰. enabled=true 时各 provider 后端用合理默认值透传 (anthropic budget_tokens=4096 / openai reasoning_effort=medium / gemini thinkingBudget=4096). 不做旧 JSON 字段迁移, 老配置直接失效.
 * @keywords-cn 迁移, AI模型, 思考模式, thinking, reasoning, 独立列
 * @keywords-en migration, ai-model, thinking-mode, reasoning, dedicated-column
 */
export class AiModelThinkingEnabled1774600000000
  implements MigrationInterface
{
  name = 'AiModelThinkingEnabled1774600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS thinking_enabled BOOLEAN NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ai_models DROP COLUMN IF EXISTS thinking_enabled`,
    );
  }
}
