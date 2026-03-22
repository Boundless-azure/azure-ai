import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：修复 Principal 类型
 * @description 修复以下 principal 类型：
 * 1. azure-ai (Azure AI 助手): agent -> official
 * 2. ai-notify (系统通知): system -> official
 * @keywords-cn 迁移, principal类型, official
 * @keywords-en migration, principal-type, official
 */
export class FixPrincipalTypes1773952000000 implements MigrationInterface {
  name = 'FixPrincipalTypes1773952000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fix azure-ai principal type: agent -> official
    await queryRunner.query(`
      UPDATE principals SET principal_type = 'official' WHERE id = 'azure-ai'
    `);

    // Fix ai-notify principal type: system -> official
    await queryRunner.query(`
      UPDATE principals SET principal_type = 'official' WHERE id = 'ai-notify'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert azure-ai principal type: official -> agent
    await queryRunner.query(`
      UPDATE principals SET principal_type = 'agent' WHERE id = 'azure-ai'
    `);

    // Revert ai-notify principal type: official -> system
    await queryRunner.query(`
      UPDATE principals SET principal_type = 'system' WHERE id = 'ai-notify'
    `);
  }
}
