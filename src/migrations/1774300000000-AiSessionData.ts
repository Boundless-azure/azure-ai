import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：AI Session Data 扩展
 * @description 为 chat_sessions_data 新增 data_key / data_title 列，放宽 data_type CHECK 约束以支持 ai_session 类型。
 * @keywords-cn 迁移, 会话数据, AI, session-data
 * @keywords-en migration, session-data, ai-session, data-key
 */
export class AiSessionData1774300000000 implements MigrationInterface {
  name = 'AiSessionData1774300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) 新列 :: PG 用 IF NOT EXISTS 兜底重跑 (MySQL 没这个语法但项目跑 PG)
    await queryRunner.query(
      `ALTER TABLE chat_sessions_data ADD COLUMN IF NOT EXISTS data_key VARCHAR(255) DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_sessions_data ADD COLUMN IF NOT EXISTS data_title VARCHAR(255) DEFAULT NULL`,
    );
    // 2) 放宽 CHECK 约束 :: PG 用 DROP CONSTRAINT (MySQL 才用 DROP CHECK)
    await queryRunner.query(
      `ALTER TABLE chat_sessions_data DROP CONSTRAINT IF EXISTS chat_sessions_data_data_type_check`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_sessions_data ADD CONSTRAINT chat_sessions_data_data_type_check CHECK (data_type IN ('webmcp_schema', 'webmcp_conn', 'ai_session'))`,
    );
    // 3) 联合索引 :: PG CREATE INDEX IF NOT EXISTS 幂等
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_csd_ai_key ON chat_sessions_data (for_session_id, data_type, data_key)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PG 的 DROP INDEX 不接 ON 子句, 只认 schema-qualified 索引名
    await queryRunner.query(`DROP INDEX IF EXISTS idx_csd_ai_key`);
    await queryRunner.query(
      `ALTER TABLE chat_sessions_data DROP CONSTRAINT IF EXISTS chat_sessions_data_data_type_check`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_sessions_data ADD CONSTRAINT chat_sessions_data_data_type_check CHECK (data_type IN ('webmcp_schema', 'webmcp_conn'))`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_sessions_data DROP COLUMN IF EXISTS data_title`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_sessions_data DROP COLUMN IF EXISTS data_key`,
    );
  }
}
