import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：新增群公告标识字段
 * @description 为 chat_session_messages 增加 is_announcement 字段与索引，用于群公告展示与管理。
 * @keywords-cn 迁移, 群公告, 字段, 索引, IM
 * @keywords-en migration, announcement, column, index, im
 */
export class AddChatMessageAnnouncement1769870000000 implements MigrationInterface {
  name = 'AddChatMessageAnnouncement1769870000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE chat_session_messages ADD COLUMN IF NOT EXISTS is_announcement BOOLEAN NOT NULL DEFAULT FALSE`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_chat_msg_session_announcement_created ON chat_session_messages(session_id, is_announcement, created_at DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_chat_msg_session_announcement_created`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_session_messages DROP COLUMN IF EXISTS is_announcement`,
    );
  }
}
