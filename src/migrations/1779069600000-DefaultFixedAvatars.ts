import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：固定入口默认头像
 * @description 为 Azure AI 助手和系统通知固定入口写入专属默认头像。
 * @keywords-cn 迁移, 默认头像, Azure助手, 系统通知
 * @keywords-en migration, default-avatar, azure-assistant, system-notify
 */
export class DefaultFixedAvatars1779069600000 implements MigrationInterface {
  name = 'DefaultFixedAvatars1779069600000';

  /**
   * 写入固定入口头像路径。
   * @keyword-en fixed-entry-avatar-up
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    const azureAvatar = '/static/system/avatars/azure-ai.png';
    const systemNotifyAvatar = '/static/system/avatars/system-notify.png';

    await queryRunner.query(
      `UPDATE principals
       SET avatar_url = $1
       WHERE id = $2`,
      [azureAvatar, 'azure-ai'],
    );

    await queryRunner.query(
      `UPDATE agents
       SET avatar_url = $1
       WHERE id = $2`,
      [azureAvatar, 'azure-ai'],
    );

    await queryRunner.query(
      `UPDATE chat_sessions
       SET avatar_url = $1
       WHERE session_id = $2`,
      [azureAvatar, 'azure-ai'],
    );

    await queryRunner.query(
      `UPDATE principals
       SET avatar_url = $1
       WHERE id = $2`,
      [systemNotifyAvatar, 'ai-notify'],
    );

    await queryRunner.query(
      `UPDATE chat_sessions
       SET avatar_url = $1
       WHERE session_id = $2`,
      [systemNotifyAvatar, 'ai-notify'],
    );
  }

  /**
   * 回滚固定入口头像路径。
   * @keyword-en fixed-entry-avatar-down
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE principals
       SET avatar_url = NULL
       WHERE id IN ($1, $2)`,
      ['azure-ai', 'ai-notify'],
    );

    await queryRunner.query(
      `UPDATE agents
       SET avatar_url = NULL
       WHERE id = $1`,
      ['azure-ai'],
    );

    await queryRunner.query(
      `UPDATE chat_sessions
       SET avatar_url = NULL
       WHERE session_id IN ($1, $2)`,
      ['azure-ai', 'ai-notify'],
    );
  }
}
