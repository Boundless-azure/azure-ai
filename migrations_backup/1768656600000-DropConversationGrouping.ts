import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 删除对话分组相关表并移除会话外键
 * @description 去除 chat_day_groups 与 chat_conversation_groups，并从 chat_sessions 移除 conversation_group_id 外键与列，统一改用 chat_sessions/chat_session_messages。
 * @keywords-cn 迁移, 删除表, 对话分组, 会话
 * @keywords-en migration, drop-tables, conversation-grouping, sessions
 */
export class DropConversationGrouping1768656600000 implements MigrationInterface {
  name = 'DropConversationGrouping1768656600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 尝试移除 chat_sessions 外键（不同方言兼容）
    try {
      await queryRunner.query(
        'ALTER TABLE chat_sessions DROP CONSTRAINT IF EXISTS fk_session_conv_group',
      );
    } catch {
      try {
        await queryRunner.query(
          'ALTER TABLE chat_sessions DROP FOREIGN KEY fk_session_conv_group',
        );
      } catch {
        // ignore
      }
    }

    // 尝试删除索引与列
    try {
      await queryRunner.query(
        'DROP INDEX IF EXISTS idx_chat_sessions_conv_group',
      );
    } catch {
      // MySQL: DROP INDEX 需要 ON 表名
      try {
        await queryRunner.query(
          'DROP INDEX idx_chat_sessions_conv_group ON chat_sessions',
        );
      } catch {
        // ignore
      }
    }
    try {
      await queryRunner.query(
        'ALTER TABLE chat_sessions DROP COLUMN IF EXISTS conversation_group_id',
      );
    } catch {
      try {
        await queryRunner.query(
          'ALTER TABLE chat_sessions DROP COLUMN conversation_group_id',
        );
      } catch {
        // ignore
      }
    }

    // 删除分组相关表
    try {
      await queryRunner.query('DROP TABLE IF EXISTS chat_conversation_groups');
    } catch {
      // ignore
    }
    try {
      await queryRunner.query('DROP TABLE IF EXISTS chat_day_groups');
    } catch {
      // ignore
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 尝试恢复基础表与列（最小集合，便于回滚）
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_day_groups (
        id CHAR(36) PRIMARY KEY,
        "date" VARCHAR(20) NOT NULL,
        title VARCHAR(255),
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ,
        CONSTRAINT uq_chat_day_groups_date UNIQUE ("date")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_chat_day_groups_date ON chat_day_groups ("date")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_chat_day_groups_is_delete ON chat_day_groups (is_delete)',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_conversation_groups (
        id CHAR(36) PRIMARY KEY,
        day_group_id CHAR(36) NOT NULL,
        chat_client_id VARCHAR(100),
        title VARCHAR(255),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ,
        CONSTRAINT fk_conv_group_day FOREIGN KEY (day_group_id) REFERENCES chat_day_groups(id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_chat_conversation_groups_day ON chat_conversation_groups (day_group_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_chat_conversation_groups_active ON chat_conversation_groups (active)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_chat_conversation_groups_is_delete ON chat_conversation_groups (is_delete)',
    );

    // 恢复 chat_sessions 列与外键
    try {
      await queryRunner.query(
        'ALTER TABLE chat_sessions ADD COLUMN conversation_group_id CHAR(36)',
      );
    } catch {
      // ignore
    }
    try {
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_chat_sessions_conv_group ON chat_sessions (conversation_group_id)',
      );
    } catch {
      // ignore
    }
    try {
      await queryRunner.query(
        'ALTER TABLE chat_sessions ADD CONSTRAINT fk_session_conv_group FOREIGN KEY (conversation_group_id) REFERENCES chat_conversation_groups(id) ON DELETE SET NULL',
      );
    } catch {
      // ignore
    }
  }
}
