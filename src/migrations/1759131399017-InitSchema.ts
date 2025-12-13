import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1759131399017 implements MigrationInterface {
  name = 'InitSchema1759131399017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS vector');

    await queryRunner.query('DROP TABLE IF EXISTS chat_sessions');
    await queryRunner.query('DROP TABLE IF EXISTS prompt_templates');
    await queryRunner.query('DROP TABLE IF EXISTS ai_models');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_models (
        id CHAR(36) PRIMARY KEY,
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
      'CREATE INDEX IF NOT EXISTS idx_ai_models_name ON ai_models (name)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_ai_models_provider_type ON ai_models (provider, type)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_ai_models_status_enabled ON ai_models (status, enabled)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_ai_models_is_delete ON ai_models (is_delete)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_ai_models_channel_id ON ai_models (channel_id)',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS prompt_templates (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        template TEXT NOT NULL,
        variables JSONB NOT NULL,
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
      'CREATE INDEX IF NOT EXISTS idx_prompt_templates_name ON prompt_templates (name)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_prompt_templates_category_enabled ON prompt_templates (category, enabled)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_prompt_templates_is_delete ON prompt_templates (is_delete)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_prompt_templates_channel_id ON prompt_templates (channel_id)',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id CHAR(36) PRIMARY KEY,
        session_id VARCHAR(100) NOT NULL,
        user_id VARCHAR(100),
        messages JSONB NOT NULL,
        system_prompt TEXT,
        metadata JSONB,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ,
        CONSTRAINT uq_chat_sessions_session_id UNIQUE (session_id)
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions (user_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_chat_sessions_is_delete ON chat_sessions (is_delete)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_chat_sessions_channel_id ON chat_sessions (channel_id)',
    );

    await queryRunner.query(`
      INSERT INTO ai_models (id, name, "displayName", provider, type, status, "apiKey", description, enabled)
      VALUES
      (gen_random_uuid()::text, 'gemini-1.5-pro', 'Gemini 1.5 Pro', 'gemini', 'chat', 'active', 'CHANGE_ME', 'Google Gemini 1.5 Pro 模型', TRUE),
      (gen_random_uuid()::text, 'deepseek-chat', 'DeepSeek Chat', 'deepseek', 'chat', 'active', 'CHANGE_ME', 'DeepSeek Chat 模型', TRUE)
    `);

    await queryRunner.query(`
      INSERT INTO prompt_templates (id, name, template, variables, category, description, enabled)
      VALUES
      (gen_random_uuid()::text, 'default_assistant', 'You are a helpful AI assistant.', '[]'::jsonb, 'system', '默认助手提示词', TRUE),
      (gen_random_uuid()::text, 'code_helper', 'You are an experienced programming assistant. Help users write clean, efficient code.', '[]'::jsonb, 'system', '编程助手提示词', TRUE),
      (gen_random_uuid()::text, 'translator', 'You are a professional translator. Translate text accurately while maintaining context and tone.', '[]'::jsonb, 'system', '翻译助手提示词', TRUE)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS chat_sessions');
    await queryRunner.query('DROP TABLE IF EXISTS prompt_templates');
    await queryRunner.query('DROP TABLE IF EXISTS ai_models');
  }
}
