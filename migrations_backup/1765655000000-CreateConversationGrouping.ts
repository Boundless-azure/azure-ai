import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateConversationGrouping1765655000000 implements MigrationInterface {
  name = 'CreateConversationGrouping1765655000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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

    // chat_sessions: add conversation_group_id
    try {
      await queryRunner.query(
        'ALTER TABLE chat_sessions ADD COLUMN conversation_group_id CHAR(36)',
      );
    } catch {
      void 0;
    }

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_chat_sessions_conv_group ON chat_sessions (conversation_group_id)',
    );
    try {
      await queryRunner.query(
        'ALTER TABLE chat_sessions ADD CONSTRAINT fk_session_conv_group FOREIGN KEY (conversation_group_id) REFERENCES chat_conversation_groups(id) ON DELETE SET NULL',
      );
    } catch {
      void 0;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.query(
        'ALTER TABLE chat_sessions DROP CONSTRAINT IF EXISTS fk_session_conv_group',
      );
    } catch {
      void 0;
    }
    try {
      await queryRunner.query(
        'ALTER TABLE chat_sessions DROP COLUMN IF EXISTS conversation_group_id',
      );
    } catch {
      void 0;
    }
    await queryRunner.query('DROP TABLE IF EXISTS chat_conversation_groups');
    await queryRunner.query('DROP TABLE IF EXISTS chat_day_groups');
  }
}
