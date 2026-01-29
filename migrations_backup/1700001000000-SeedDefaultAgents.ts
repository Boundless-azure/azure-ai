import { MigrationInterface, QueryRunner } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

/**
 * @title 迁移：初始化默认Agent数据
 * @description 将 code-agent 与 workflow-agent 写入 agents 表（若不存在）。不设置向量，后续由接口更新。
 * @keywords-cn 迁移, 默认数据, code-agent, workflow-agent
 * @keywords-en migration, seed-data, code-agent, workflow-agent
 */
export class SeedDefaultAgents1700001000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const type = (queryRunner.connection.options as { type?: string }).type;
    const isPg = type === 'postgres';

    const entries: Array<{
      codeDir: string;
      nickname: string;
      purpose: string;
      keywords: string[];
    }> = [
      {
        codeDir: 'src/agents/code-agent',
        nickname: '代码智能体',
        purpose: '根据用户问题生成代码，使用工具执行，支持对话与动态调度。',
        keywords: ['代码', '智能体', 'code-agent', '工具调用', '编排'],
      },
      {
        codeDir: 'src/agents/workflow-agent',
        nickname: '工作流智能体',
        purpose: '用于编排工作流与任务，协助多步骤流程执行。',
        keywords: ['工作流', '智能体', 'workflow', '编排', '任务'],
      },
    ];

    for (const e of entries) {
      const existsSqlPg =
        'SELECT id FROM agents WHERE code_dir = $1 AND is_delete = false LIMIT 1';
      const existsSqlOther =
        'SELECT id FROM agents WHERE code_dir = ? AND is_delete = 0 LIMIT 1';
      const exists = await queryRunner.query(
        isPg ? existsSqlPg : existsSqlOther,
        [e.codeDir],
      );
      if (Array.isArray(exists) && exists.length > 0) continue;

      const id = uuidv7();
      const nowFn = isPg ? 'NOW()' : 'NOW()';
      const keywordsJson = JSON.stringify(e.keywords);

      if (isPg) {
        await queryRunner.query(
          `INSERT INTO agents 
          (id, code_dir, nickname, is_ai_generated, purpose, embedding, keywords, nodes, conversation_group_id, active, is_delete, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, NULL, $6::json, NULL, NULL, TRUE, FALSE, ${nowFn}, ${nowFn})`,
          [id, e.codeDir, e.nickname, false, e.purpose, keywordsJson],
        );
      } else {
        await queryRunner.query(
          `INSERT INTO agents 
          (id, code_dir, nickname, is_ai_generated, purpose, embedding, keywords, nodes, conversation_group_id, active, is_delete, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, NULL, 1, 0, ${nowFn}, ${nowFn})`,
          [id, e.codeDir, e.nickname, 0, e.purpose, keywordsJson],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const type = (queryRunner.connection.options as { type?: string }).type;
    const isPg = type === 'postgres';
    const delSqlPg =
      'DELETE FROM agents WHERE code_dir IN ($1, $2) AND is_delete = false';
    const delSqlOther =
      'DELETE FROM agents WHERE code_dir IN (?, ?) AND is_delete = 0';
    await queryRunner.query(isPg ? delSqlPg : delSqlOther, [
      'src/agents/code-agent',
      'src/agents/workflow-agent',
    ]);
  }
}
