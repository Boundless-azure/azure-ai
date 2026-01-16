import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 增加对话线程字段
 * @description 为 chat_conversation_groups 增加线程类型、置顶、AI参与与参与者字段；保持现有按日分组兼容。
 * @keywords-cn 对话线程, 置顶, AI参与, 参与者
 * @keywords-en conversation-thread, pinned, ai-involved, participants
 */
export class AddConversationThreadFields1767366805000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE chat_conversation_groups ADD COLUMN IF NOT EXISTS thread_type VARCHAR(20) DEFAULT 'group'`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_conversation_groups ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_conversation_groups ADD COLUMN IF NOT EXISTS is_ai_involved BOOLEAN DEFAULT FALSE`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_conversation_groups ADD COLUMN IF NOT EXISTS participants JSON`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_chat_conversation_groups_thread_type ON chat_conversation_groups (thread_type)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_chat_conversation_groups_is_pinned ON chat_conversation_groups (is_pinned)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 轻量回滚：删除新增索引与列（忽略不存在错误）
    try {
      await queryRunner.query(
        `DROP INDEX IF EXISTS idx_chat_conversation_groups_thread_type`,
      );
    } catch {
      void 0;
    }
    try {
      await queryRunner.query(
        `DROP INDEX IF EXISTS idx_chat_conversation_groups_is_pinned`,
      );
    } catch {
      void 0;
    }
    try {
      await queryRunner.query(
        `ALTER TABLE chat_conversation_groups DROP COLUMN IF EXISTS participants`,
      );
    } catch {
      void 0;
    }
    try {
      await queryRunner.query(
        `ALTER TABLE chat_conversation_groups DROP COLUMN IF EXISTS is_ai_involved`,
      );
    } catch {
      void 0;
    }
    try {
      await queryRunner.query(
        `ALTER TABLE chat_conversation_groups DROP COLUMN IF EXISTS is_pinned`,
      );
    } catch {
      void 0;
    }
    try {
      await queryRunner.query(
        `ALTER TABLE chat_conversation_groups DROP COLUMN IF EXISTS thread_type`,
      );
    } catch {
      void 0;
    }
  }
}
