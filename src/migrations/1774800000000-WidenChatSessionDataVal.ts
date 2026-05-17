import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：放宽 chat_sessions_data.data_val 容量
 * @description call log 必须完整硬记录 payload/result, MySQL/MariaDB 下把 TEXT 放宽到 LONGTEXT; 其他数据库 text 已可承载大文本或保持兼容。
 * @keywords-cn 迁移, 会话数据, 调用日志, 大文本
 * @keywords-en migration, session-data, call-log, longtext
 */
export class WidenChatSessionDataVal1774800000000
  implements MigrationInterface
{
  name = 'WidenChatSessionDataVal1774800000000';

  /**
   * 执行容量放宽迁移
   * @keyword-en widen-chat-session-data-val
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    const type = queryRunner.connection.options.type;
    if (type === 'mysql' || type === 'mariadb') {
      await queryRunner.query(
        `ALTER TABLE chat_sessions_data MODIFY data_val LONGTEXT NOT NULL`,
      );
      return;
    }
    if (type === 'postgres') {
      await queryRunner.query(
        `ALTER TABLE chat_sessions_data ALTER COLUMN data_val TYPE TEXT`,
      );
    }
  }

  /**
   * 回滚为原始 TEXT 定义
   * @keyword-en rollback-chat-session-data-val
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    const type = queryRunner.connection.options.type;
    if (type === 'mysql' || type === 'mariadb') {
      await queryRunner.query(
        `ALTER TABLE chat_sessions_data MODIFY data_val TEXT NOT NULL`,
      );
      return;
    }
    if (type === 'postgres') {
      await queryRunner.query(
        `ALTER TABLE chat_sessions_data ALTER COLUMN data_val TYPE TEXT`,
      );
    }
  }
}
