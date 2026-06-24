import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：修复 Agent 模型槽位 ID
 * @description 将 agents.ai_model_ids 中误存的模型 name 迁移为 ai_models.id。
 * @keywords-cn 迁移, Agent模型槽位, 模型ID
 * @keywords-en migration, agent-model-slots, model-id
 */
export class AgentAiModelIdsUseIds1779607000000 implements MigrationInterface {
  name = 'AgentAiModelIdsUseIds1779607000000';

  /**
   * 将历史 name 值按 ai_models.name 映射为 ai_models.id。
   * @keyword-en agent-model-ids-up, model-slot-id
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH model_lookup AS (
        SELECT DISTINCT ON (name)
          name,
          id
        FROM ai_models
        WHERE is_delete = false
        ORDER BY name, enabled DESC, created_at ASC
      ),
      normalized AS (
        SELECT
          a.id,
          jsonb_agg(
            to_jsonb(COALESCE(by_id.id, by_name.id, item.value))
            ORDER BY item.ordinality
          ) AS next_ai_model_ids
        FROM agents a
        CROSS JOIN LATERAL jsonb_array_elements_text(
          CASE
            WHEN a.ai_model_ids IS NOT NULL
             AND jsonb_typeof(a.ai_model_ids::jsonb) = 'array'
            THEN a.ai_model_ids::jsonb
            ELSE '[]'::jsonb
          END
        )
          WITH ORDINALITY AS item(value, ordinality)
        LEFT JOIN ai_models by_id
          ON by_id.id = item.value
         AND by_id.is_delete = false
        LEFT JOIN model_lookup by_name
          ON by_name.name = item.value
        WHERE a.ai_model_ids IS NOT NULL
        GROUP BY a.id
      )
      UPDATE agents a
      SET ai_model_ids = normalized.next_ai_model_ids
      FROM normalized
      WHERE a.id = normalized.id
        AND a.ai_model_ids::jsonb IS DISTINCT FROM normalized.next_ai_model_ids
    `);
  }

  /**
   * 数据修复迁移不回滚到模型 name，避免重新引入脏数据。
   * @keyword-en agent-model-ids-down, rollback-guard
   */
  public async down(_queryRunner: QueryRunner): Promise<void> {
    // no-op: keep ai_model_ids as stable ai_models.id values.
  }
}
