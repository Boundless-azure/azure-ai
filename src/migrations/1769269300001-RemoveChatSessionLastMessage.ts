import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：移除会话最后消息字段
 * @description 从 chat_sessions 表中移除 last_message_at 和 last_message_preview 字段与索引
 * @keywords-cn 迁移, 会话, 最后一条消息, 字段, 索引
 * @keywords-en migration, session, last-message, column, index
 */
export class RemoveChatSessionLastMessage1769269300001 implements MigrationInterface {
  name = 'RemoveChatSessionLastMessage1769269300001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_chat_sessions_last_message_at`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_sessions DROP COLUMN IF EXISTS last_message_at`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_sessions DROP COLUMN IF EXISTS last_message_preview`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS last_message_preview VARCHAR(255)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_message_at ON chat_sessions(last_message_at)`,
    );
  }
}
