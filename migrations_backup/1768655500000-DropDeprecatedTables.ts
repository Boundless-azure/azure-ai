import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropDeprecatedTables1768655500000 implements MigrationInterface {
  name = 'DropDeprecatedTables1768655500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS chat_segments');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_segments (
        id CHAR(36) PRIMARY KEY,
        session_id VARCHAR(100) NOT NULL,
        day VARCHAR(10) NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT NULL,
        message_ids JSONB NOT NULL,
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ,
        CONSTRAINT fk_chat_seg_session FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_chat_seg_session_id ON chat_segments (session_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_chat_seg_session_day ON chat_segments (session_id, day)',
    );
  }
}
