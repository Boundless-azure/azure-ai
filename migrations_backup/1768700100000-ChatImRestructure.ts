import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：Chat IM 结构重构
 * @description 重构 chat_sessions 和 chat_session_messages 表以支持 IM 功能。
 * @keywords-cn 迁移, IM, 会话, 消息
 * @keywords-en migration, im, session, message
 */
export class ChatImRestructure1768700100000 implements MigrationInterface {
  name = 'ChatImRestructure1768700100000';

  private getDbType(queryRunner: QueryRunner): string {
    const raw = (queryRunner.connection.options as { type?: unknown }).type;
    return typeof raw === 'string' ? raw : 'mysql';
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const type = this.getDbType(queryRunner);
    const isPg = type === 'postgres';
    const isSqlite = type === 'sqlite';

    // ========== 1. 修改 chat_sessions 表 ==========

    // 添加新字段
    if (isPg) {
      // 创建 enum 类型
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE chat_session_type AS ENUM ('private', 'group', 'channel');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS name varchar(255) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS type chat_session_type DEFAULT 'private'`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS creator_id char(36) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS avatar_url varchar(255) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS description text NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS last_message_preview varchar(255) NULL`,
      );

      // 注意：保留 user_id, system_prompt, conversation_group_id 用于向后兼容
    } else if (isSqlite) {
      // SQLite
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN name varchar(255) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN type varchar(20) DEFAULT 'private'`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN creator_id char(36) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN avatar_url varchar(255) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN description text NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN last_message_at DATETIME NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN last_message_preview varchar(255) NULL`,
      );
    } else {
      // MySQL
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN name varchar(255) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN type ENUM('private', 'group', 'channel') DEFAULT 'private'`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN creator_id char(36) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN avatar_url varchar(255) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN description text NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN last_message_at TIMESTAMP NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN last_message_preview varchar(255) NULL`,
      );

      // 注意：保留 user_id, system_prompt, conversation_group_id 用于向后兼容
    }

    // ========== 2. 修改 chat_session_messages 表 ==========

    if (isPg) {
      // 创建 enum 类型
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE chat_message_type AS ENUM ('text', 'image', 'file', 'system');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      await queryRunner.query(
        `ALTER TABLE chat_session_messages ADD COLUMN IF NOT EXISTS sender_id char(36) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages ADD COLUMN IF NOT EXISTS message_type chat_message_type DEFAULT 'text'`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages ADD COLUMN IF NOT EXISTS reply_to_id char(36) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages ADD COLUMN IF NOT EXISTS attachments json NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ NULL`,
      );

      // 注意：保留 role, keywords 用于向后兼容
    } else if (isSqlite) {
      await queryRunner.query(
        `ALTER TABLE chat_session_messages ADD COLUMN sender_id char(36) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages ADD COLUMN message_type varchar(20) DEFAULT 'text'`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages ADD COLUMN reply_to_id char(36) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages ADD COLUMN attachments text NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages ADD COLUMN is_edited boolean DEFAULT 0`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages ADD COLUMN edited_at DATETIME NULL`,
      );
    } else {
      // MySQL
      await queryRunner.query(
        `ALTER TABLE chat_session_messages ADD COLUMN sender_id char(36) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages ADD COLUMN message_type ENUM('text', 'image', 'file', 'system') DEFAULT 'text'`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages ADD COLUMN reply_to_id char(36) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages ADD COLUMN attachments json NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages ADD COLUMN is_edited boolean DEFAULT 0`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages ADD COLUMN edited_at TIMESTAMP NULL`,
      );

      // 注意：保留 role, keywords 用于向后兼容
    }

    // ========== 3. 创建索引 ==========
    if (isPg) {
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
        `CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_session_messages(sender_id)`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to_id ON chat_session_messages(reply_to_id)`,
      );
    } else if (!isSqlite) {
      try {
        await queryRunner.query(
          `CREATE INDEX idx_chat_sessions_creator_id ON chat_sessions(creator_id)`,
        );
        await queryRunner.query(
          `CREATE INDEX idx_chat_sessions_type ON chat_sessions(type)`,
        );
        await queryRunner.query(
          `CREATE INDEX idx_chat_sessions_last_message_at ON chat_sessions(last_message_at)`,
        );
        await queryRunner.query(
          `CREATE INDEX idx_chat_messages_sender_id ON chat_session_messages(sender_id)`,
        );
        await queryRunner.query(
          `CREATE INDEX idx_chat_messages_reply_to_id ON chat_session_messages(reply_to_id)`,
        );
      } catch (e) {
        /* 索引可能已存在 */
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const type = this.getDbType(queryRunner);
    const isPg = type === 'postgres';
    const isSqlite = type === 'sqlite';

    // 恢复 chat_session_messages 旧字段
    if (isPg) {
      await queryRunner.query(
        `ALTER TABLE chat_session_messages ADD COLUMN role varchar(20) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages ADD COLUMN keywords json NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages DROP COLUMN IF EXISTS sender_id`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages DROP COLUMN IF EXISTS message_type`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages DROP COLUMN IF EXISTS reply_to_id`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages DROP COLUMN IF EXISTS attachments`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages DROP COLUMN IF EXISTS is_edited`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages DROP COLUMN IF EXISTS edited_at`,
      );
    } else if (!isSqlite) {
      await queryRunner.query(
        `ALTER TABLE chat_session_messages ADD COLUMN role ENUM('system', 'user', 'assistant') NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages ADD COLUMN keywords json NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages DROP COLUMN sender_id`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages DROP COLUMN message_type`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages DROP COLUMN reply_to_id`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages DROP COLUMN attachments`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages DROP COLUMN is_edited`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_session_messages DROP COLUMN edited_at`,
      );
    }

    // 恢复 chat_sessions 旧字段
    if (isPg) {
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN user_id varchar(100) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN system_prompt text NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN conversation_group_id char(36) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions DROP COLUMN IF EXISTS name`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions DROP COLUMN IF EXISTS type`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions DROP COLUMN IF EXISTS creator_id`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions DROP COLUMN IF EXISTS avatar_url`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions DROP COLUMN IF EXISTS description`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions DROP COLUMN IF EXISTS last_message_at`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions DROP COLUMN IF EXISTS last_message_preview`,
      );
    } else if (!isSqlite) {
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN user_id varchar(100) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN system_prompt text NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions ADD COLUMN conversation_group_id char(36) NULL`,
      );
      await queryRunner.query(`ALTER TABLE chat_sessions DROP COLUMN name`);
      await queryRunner.query(`ALTER TABLE chat_sessions DROP COLUMN type`);
      await queryRunner.query(
        `ALTER TABLE chat_sessions DROP COLUMN creator_id`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions DROP COLUMN avatar_url`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions DROP COLUMN description`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions DROP COLUMN last_message_at`,
      );
      await queryRunner.query(
        `ALTER TABLE chat_sessions DROP COLUMN last_message_preview`,
      );
    }
  }
}
