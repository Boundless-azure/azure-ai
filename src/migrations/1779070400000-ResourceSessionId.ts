import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：资源关联会话
 * @description 为 resources 表增加可选 session_id 字段，用于聊天文件列表按会话读取。
 * @keywords-cn 迁移, resources, session_id, 聊天文件
 * @keywords-en migration, resources, session-id, chat-files
 */
export class ResourceSessionId1779070400000 implements MigrationInterface {
  name = 'ResourceSessionId1779070400000';

  /**
   * 增加 resources.session_id 与索引。
   * @keyword-en resource-session-id-up
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE resources ADD COLUMN IF NOT EXISTS session_id VARCHAR(100)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_resources_session_id ON resources(session_id)`,
    );
  }

  /**
   * 移除 resources.session_id 与索引。
   * @keyword-en resource-session-id-down
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_resources_session_id`);
    await queryRunner.query(
      `ALTER TABLE resources DROP COLUMN IF EXISTS session_id`,
    );
  }
}
