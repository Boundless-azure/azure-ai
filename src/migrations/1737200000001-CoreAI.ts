import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：核心 AI 模块
 * @description 创建 AI 模型和提示词模板表
 * @keywords-cn 迁移, AI模型, 提示词, 模板
 * @keywords-en migration, ai-model, prompt, template
 */
export class CoreAI1737200000001 implements MigrationInterface {
  name = 'CoreAI1737200000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 启用必要扩展
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "vector"`);

    // 创建 UUID v7 生成函数
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION uuid_generate_v7() RETURNS uuid AS $$
      DECLARE
        unix_ts_ms bytea;
        uuid_bytes bytea;
      BEGIN
        unix_ts_ms = substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3);
        uuid_bytes = unix_ts_ms || gen_random_bytes(10);
        uuid_bytes = set_byte(uuid_bytes, 6, (b'0111' || get_byte(uuid_bytes, 6)::bit(4))::bit(8)::int);
        uuid_bytes = set_byte(uuid_bytes, 8, (b'10' || get_byte(uuid_bytes, 8)::bit(6))::bit(8)::int);
        RETURN encode(uuid_bytes, 'hex')::uuid;
      END
      $$ LANGUAGE plpgsql VOLATILE;
    `);

    // ai_models: AI 模型配置表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_models (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        name VARCHAR(100) NOT NULL,
        "displayName" VARCHAR(200),
        provider VARCHAR(50) NOT NULL,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        "apiKey" VARCHAR(500) NOT NULL,
        "baseURL" VARCHAR(500),
        "azureConfig" JSONB,
        "defaultParams" JSONB,
        description TEXT,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ai_models_name ON ai_models (name)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ai_models_provider_type ON ai_models (provider, type)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ai_models_status_enabled ON ai_models (status, enabled)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ai_models_is_delete ON ai_models (is_delete)`,
    );

    // prompt_templates: 提示词模板表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS prompt_templates (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        name VARCHAR(100) NOT NULL,
        template TEXT NOT NULL,
        variables JSONB NOT NULL DEFAULT '[]'::jsonb,
        description TEXT,
        category VARCHAR(50),
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_prompt_templates_name ON prompt_templates (name)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_prompt_templates_category_enabled ON prompt_templates (category, enabled)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_prompt_templates_is_delete ON prompt_templates (is_delete)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS prompt_templates`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_models`);
  }
}
