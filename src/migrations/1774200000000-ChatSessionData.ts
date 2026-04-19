import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：chat_sessions_data 表
 * @description 创建 chat_sessions_data 表，用于存储 WebMCP 连接与 Schema 等会话扩展数据。
 * @keywords-cn 迁移, 会话数据, WebMCP
 * @keywords-en migration, session-data, webmcp
 */
export class ChatSessionData1774200000000 implements MigrationInterface {
  name = 'ChatSessionData1774200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions_data (
        id             CHAR(36)     NOT NULL,
        data_type      VARCHAR(50)  NOT NULL CHECK (data_type IN ('webmcp_schema', 'webmcp_conn')),
        data_val       TEXT         NOT NULL,
        for_session_id VARCHAR(100) NOT NULL,
        created_user   CHAR(36),
        update_user    CHAR(36),
        channel_id     VARCHAR(100),
        is_delete      BOOLEAN      DEFAULT false,
        created_at     TIMESTAMP    DEFAULT NOW(),
        updated_at     TIMESTAMP    DEFAULT NOW(),
        deleted_at     TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_csd_session  ON chat_sessions_data (for_session_id)`);
    await queryRunner.query(`CREATE INDEX idx_csd_type     ON chat_sessions_data (for_session_id, data_type)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS chat_sessions_data`);
  }
}
