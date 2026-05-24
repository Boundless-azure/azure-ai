import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：Azure AI Agent
 * @description 初始化 Azure AI 助手 Agent，使用固定的 ID `azure-ai`
 * @keywords-cn 迁移, Azure AI, 此 Agent
 * @keywords-en migration, azure-ai, agent
 */
export class AzureAIAgent1737200000009 implements MigrationInterface {
  name = 'AzureAIAgent1737200000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const agentId = 'azure-ai';
    const principalId = 'azure-ai'; // Use same ID for principal for simplicity and predictability

    // 1. Insert Principal
    await queryRunner.query(
      `INSERT INTO principals (id, display_name, principal_type, active) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET active = $4`,
      [principalId, 'Azure AI 助手', 'agent', true],
    );

    // 2. Insert Agent
    // Note: Assuming 'src/agents/azure-ai' as code_dir, though it might differ.
    // The key is the ID and principal connection.
    await queryRunner.query(
      `INSERT INTO agents (id, code_dir, nickname, is_ai_generated, purpose, keywords, principal_id, active) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8) ON CONFLICT (id) DO UPDATE SET active = $8`,
      [
        agentId,
        'src/agents/azure-ai', // Placeholder path
        'Azure AI 助手',
        false,
        '官方 Azure AI 助手，提供智能问答与辅助功能。',
        JSON.stringify(['Azure', 'AI', '助手', '官方']),
        principalId,
        true,
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const agentId = 'azure-ai';
    const principalId = 'azure-ai';

    await queryRunner.query(`DELETE FROM agents WHERE id = $1`, [agentId]);
    await queryRunner.query(`DELETE FROM principals WHERE id = $1`, [
      principalId,
    ]);
  }
}
