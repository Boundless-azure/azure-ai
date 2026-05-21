import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：chat_sessions_data 加 ai_call_log 类型
 * @description 把 data_type CHECK 约束放宽到包含 'ai_call_log',
 *              用于 AiCallLogService 硬记录 call_hook 调用日志 (FIFO 50 条/session, 仅成功项).
 *              不新增列, 复用现有 data_key/data_title/data_val/created_user 字段.
 * @keywords-cn 迁移, 会话数据, 调用日志, ai_call_log
 * @keywords-en migration, session-data, call-log, ai-call-log
 */
export class AddAiCallLogDataType1774700000000 implements MigrationInterface {
  name = 'AddAiCallLogDataType1774700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // PG 路径 :: DROP + ADD CONSTRAINT 重建 CHECK
    await queryRunner.query(
      `ALTER TABLE chat_sessions_data DROP CONSTRAINT IF EXISTS chat_sessions_data_data_type_check`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_sessions_data ADD CONSTRAINT chat_sessions_data_data_type_check CHECK (data_type IN ('webmcp_schema', 'webmcp_conn', 'ai_session', 'ai_call_log'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 回滚前清掉所有 ai_call_log 行, 否则恢复 CHECK 会失败
    await queryRunner.query(
      `DELETE FROM chat_sessions_data WHERE data_type = 'ai_call_log'`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_sessions_data DROP CONSTRAINT IF EXISTS chat_sessions_data_data_type_check`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_sessions_data ADD CONSTRAINT chat_sessions_data_data_type_check CHECK (data_type IN ('webmcp_schema', 'webmcp_conn', 'ai_session'))`,
    );
  }
}
