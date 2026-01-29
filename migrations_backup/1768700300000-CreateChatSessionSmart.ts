import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：会话智能分析表
 * @description 创建 chat_session_smart 表用于 AI 分析消息段落。
 * @keywords-cn 迁移, 会话智能, 关键词, 向量
 * @keywords-en migration, session-smart, keywords, vector
 */
export class CreateChatSessionSmart1768700300000 implements MigrationInterface {
  name = 'CreateChatSessionSmart1768700300000';

  private getDbType(queryRunner: QueryRunner): string {
    const raw = (queryRunner.connection.options as { type?: unknown }).type;
    return typeof raw === 'string' ? raw : 'mysql';
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const type = this.getDbType(queryRunner);
    const isPg = type === 'postgres';
    const isSqlite = type === 'sqlite';

    if (isPg) {
      // 确保 pgvector 扩展存在
      try {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
      } catch (e) {
        /* 可能没有权限或已存在 */
      }

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS chat_session_smart (
          id char(36) PRIMARY KEY,
          session_id char(36) NOT NULL,
          start_message_id char(36) NOT NULL,
          end_message_id char(36) NOT NULL,
          message_count int DEFAULT 0,
          keywords jsonb NULL,
          embedding vector(1536) NULL,
          summary text NULL,
          analyzed_at TIMESTAMPTZ NULL,
          created_user char(36) NULL,
          update_user char(36) NULL,
          channel_id varchar(100) NULL,
          is_delete boolean DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          deleted_at TIMESTAMPTZ NULL
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
    } else if (isSqlite) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS chat_session_smart (
          id char(36) PRIMARY KEY,
          session_id char(36) NOT NULL,
          start_message_id char(36) NOT NULL,
          end_message_id char(36) NOT NULL,
          message_count int DEFAULT 0,
          keywords text NULL,
          embedding text NULL,
          summary text NULL,
          analyzed_at DATETIME NULL,
          created_user char(36) NULL,
          update_user char(36) NULL,
          channel_id varchar(100) NULL,
          is_delete boolean DEFAULT 0,
          created_at DATETIME DEFAULT (datetime('now')),
          updated_at DATETIME DEFAULT (datetime('now')),
          deleted_at DATETIME NULL
        )
      `);
    } else {
      // MySQL - 使用 JSON 存储向量
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS chat_session_smart (
          id char(36) PRIMARY KEY,
          session_id char(36) NOT NULL,
          start_message_id char(36) NOT NULL,
          end_message_id char(36) NOT NULL,
          message_count int DEFAULT 0,
          keywords json NULL,
          embedding json NULL,
          summary text NULL,
          analyzed_at TIMESTAMP NULL,
          created_user char(36) NULL,
          update_user char(36) NULL,
          channel_id varchar(100) NULL,
          is_delete boolean DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP NULL
        )
      `);

      try {
        await queryRunner.query(
          `CREATE INDEX idx_css_session_id ON chat_session_smart(session_id)`,
        );
        await queryRunner.query(
          `CREATE INDEX idx_css_start_message_id ON chat_session_smart(start_message_id)`,
        );
        await queryRunner.query(
          `CREATE INDEX idx_css_end_message_id ON chat_session_smart(end_message_id)`,
        );
        await queryRunner.query(
          `CREATE INDEX idx_css_analyzed_at ON chat_session_smart(analyzed_at)`,
        );
      } catch (e) {
        /* 索引可能已存在 */
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS chat_session_smart`);
  }
}
