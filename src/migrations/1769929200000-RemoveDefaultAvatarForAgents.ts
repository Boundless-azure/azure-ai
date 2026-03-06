import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：清理 Agent 默认头像
 * @description 将 principals/agents 中的 default.svg 头像清理为 NULL，并移除 agents.avatar_url 默认值。
 * @keywords-cn 迁移, Agent, 头像, default.svg, 数据清理
 * @keywords-en migration, agent, avatar, default.svg, data-cleanup
 */
export class RemoveDefaultAvatarForAgents1769929200000 implements MigrationInterface {
  name = 'RemoveDefaultAvatarForAgents1769929200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const defaultAvatar = '/static/system/avatars/default.svg';

    await queryRunner.query(
      `UPDATE principals
       SET avatar_url = NULL
       WHERE principal_type = 'agent'
         AND avatar_url = $1`,
      [defaultAvatar],
    );

    await queryRunner.query(
      `UPDATE agents
       SET avatar_url = NULL
       WHERE avatar_url = $1`,
      [defaultAvatar],
    );

    await queryRunner.query(
      `ALTER TABLE agents ALTER COLUMN avatar_url DROP DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const defaultAvatar = '/static/system/avatars/default.svg';

    await queryRunner.query(
      `ALTER TABLE agents ALTER COLUMN avatar_url SET DEFAULT '${defaultAvatar}'`,
    );

    await queryRunner.query(
      `UPDATE principals
       SET avatar_url = $1
       WHERE principal_type = 'agent'
         AND (avatar_url IS NULL OR BTRIM(avatar_url) = '')`,
      [defaultAvatar],
    );

    await queryRunner.query(
      `UPDATE agents
       SET avatar_url = $1
       WHERE avatar_url IS NULL OR BTRIM(avatar_url) = ''`,
      [defaultAvatar],
    );
  }
}
