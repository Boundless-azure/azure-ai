import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：聊天 IM 模块
 * @description 创建会话、消息、成员、智能分析表
 * @keywords-cn 迁移, 会话, 消息, IM, 成员, 智能分析
 * @keywords-en migration, session, message, im, member, smart
 */
export class ChatIM1737200000002 implements MigrationInterface {
  name = 'ChatIM1737200000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 创建 enum 类型
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE chat_session_type AS ENUM ('private', 'group', 'channel');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE chat_message_type AS ENUM ('text', 'image', 'file', 'system');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE chat_member_role AS ENUM ('owner', 'admin', 'member');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE chat_message_role AS ENUM ('system', 'user', 'assistant');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // chat_sessions: IM 会话表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        session_id VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255),
        type chat_session_type DEFAULT 'private',
        creator_id CHAR(36),
        avatar_url VARCHAR(255),
        description TEXT,
        last_message_at TIMESTAMPTZ,
        last_message_preview VARCHAR(255),
        metadata JSONB,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        -- 向后兼容字段（已弃用）
        user_id VARCHAR(100),
        system_prompt TEXT,
        conversation_group_id CHAR(36),
        -- 审计字段
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
      `CREATE INDEX IF NOT EXISTS idx_chat_sessions_creator_id ON chat_sessions(creator_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_chat_sessions_type ON chat_sessions(type)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_message_at ON chat_sessions(last_message_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_chat_sessions_is_delete ON chat_sessions(is_delete)`,
    );

    // chat_session_messages: 消息表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_session_messages (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        session_id VARCHAR(100) NOT NULL,
        sender_id CHAR(36),
        message_type chat_message_type DEFAULT 'text',
        content TEXT NOT NULL,
        reply_to_id CHAR(36),
        attachments JSON,
        metadata JSONB,
        is_edited BOOLEAN DEFAULT FALSE,
        edited_at TIMESTAMPTZ,
        -- 向后兼容字段（已弃用）
        role chat_message_role DEFAULT 'user',
        keywords JSONB,
        -- 审计字段
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ,
        CONSTRAINT fk_chat_msg_session FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_chat_msg_session_id ON chat_session_messages(session_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_chat_msg_sender_id ON chat_session_messages(sender_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_chat_msg_session_created ON chat_session_messages(session_id, created_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_chat_msg_reply_to_id ON chat_session_messages(reply_to_id)`,
    );

    // 全文索引
    try {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_chat_session_messages_ft 
        ON chat_session_messages USING GIN (to_tsvector('simple', coalesce(content, '')))
      `);
    } catch {
      // 忽略
    }

    // chat_session_members: 会话成员表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_session_members (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        session_id CHAR(36) NOT NULL,
        principal_id CHAR(36) NOT NULL,
        role chat_member_role DEFAULT 'member',
        joined_at TIMESTAMPTZ,
        muted_until TIMESTAMPTZ,
        last_read_at TIMESTAMPTZ,
        last_read_message_id CHAR(36),
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        UNIQUE(session_id, principal_id)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_csm_session_id ON chat_session_members(session_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_csm_principal_id ON chat_session_members(principal_id)`,
    );

    // chat_session_smart: AI 智能分析片段
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_session_smart (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        session_id CHAR(36) NOT NULL,
        start_message_id CHAR(36) NOT NULL,
        end_message_id CHAR(36) NOT NULL,
        message_count INT DEFAULT 0,
        keywords JSONB,
        embedding vector(1536),
        summary TEXT,
        analyzed_at TIMESTAMPTZ,
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_css_session_id ON chat_session_smart(session_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_css_start_message_id ON chat_session_smart(start_message_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_css_end_message_id ON chat_session_smart(end_message_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_css_analyzed_at ON chat_session_smart(analyzed_at)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS chat_session_smart`);
    await queryRunner.query(`DROP TABLE IF EXISTS chat_session_members`);
    await queryRunner.query(`DROP TABLE IF EXISTS chat_session_messages`);
    await queryRunner.query(`DROP TABLE IF EXISTS chat_sessions`);
    await queryRunner.query(`DROP TYPE IF EXISTS chat_member_role`);
    await queryRunner.query(`DROP TYPE IF EXISTS chat_message_role`);
    await queryRunner.query(`DROP TYPE IF EXISTS chat_message_type`);
    await queryRunner.query(`DROP TYPE IF EXISTS chat_session_type`);
  }
}
