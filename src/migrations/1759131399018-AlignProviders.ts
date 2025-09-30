import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Align provider enum with current AIProvider values and remove legacy azure-openai records.
 */
export class AlignProviders1759131399018 implements MigrationInterface {
  name = 'AlignProviders1759131399018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) 删除旧的 Azure OpenAI 记录，避免枚举更新失败
    await queryRunner.query(
      `DELETE FROM \`ai_models\` WHERE \`provider\` = 'azure-openai'`,
    );

    // 2) 修改 provider 枚举，移除 azure-openai，新增 gemini/deepseek
    // 注意：MySQL 枚举修改需要使用 MODIFY COLUMN 语法
    await queryRunner.query(
      `ALTER TABLE \`ai_models\` MODIFY COLUMN \`provider\` ENUM('openai','anthropic','google','gemini','deepseek') NOT NULL`,
    );

    // 3) 可选：如果存在不在新枚举中的值（理论上不应该），再次清理
    await queryRunner.query(
      `DELETE FROM \`ai_models\` WHERE \`provider\` NOT IN ('openai','anthropic','google','gemini','deepseek')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 回滚：恢复原始 provider 枚举并插入一个示例 Azure OpenAI 记录（仅用于回滚一致性）
    await queryRunner.query(
      `ALTER TABLE \`ai_models\` MODIFY COLUMN \`provider\` ENUM('openai','azure-openai','anthropic','google') NOT NULL`,
    );
    await queryRunner.query(
      `INSERT INTO \`ai_models\` (id, name, displayName, provider, type, status, apiKey, description, enabled)
       VALUES (UUID(), 'gpt-35-turbo', 'Azure GPT-3.5 Turbo', 'azure-openai', 'chat', 'active', 'CHANGE_ME', 'Azure OpenAI GPT-3.5 Turbo 模型(rollback)', 0)
       ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
    );
  }
}
