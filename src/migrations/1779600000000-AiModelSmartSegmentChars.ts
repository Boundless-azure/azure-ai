import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移: ai_models 加 smart_segment_chars 独立 column
 * @description smart 历史压缩字符阈值从全局 env CHAT_SESSION_SMART_SEGMENT_CHARS 提到 model 维度.
 *   不同模型对长上下文表现差异大, 短上下文模型需要小阈值; null 时走代码默认 5000.
 * @keywords-cn 迁移, AI模型, smart分段, 字符阈值
 * @keywords-en migration, ai-model, smart-segment, char-budget
 */
export class AiModelSmartSegmentChars1779600000000 implements MigrationInterface {
  name = 'AiModelSmartSegmentChars1779600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS smart_segment_chars INT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ai_models DROP COLUMN IF EXISTS smart_segment_chars`,
    );
  }
}
