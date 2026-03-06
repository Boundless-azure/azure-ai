import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：为用户与Agent新增头像字段
 * @description 为 users 与 agents 增加 avatar_url 字段，并设置默认头像路径。
 * @keywords-cn 迁移, 头像, 用户管理, Agent, 字段
 * @keywords-en migration, avatar, user-management, agent, column
 */
export class AddAvatarUrlToUsersAndAgents1769881100000 implements MigrationInterface {
  name = 'AddAvatarUrlToUsersAndAgents1769881100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const defaultAvatar = '/static/system/avatars/default.svg';

    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE users ALTER COLUMN avatar_url SET DEFAULT '${defaultAvatar}'`,
    );
    await queryRunner.query(
      `UPDATE users SET avatar_url = '${defaultAvatar}' WHERE avatar_url IS NULL OR BTRIM(avatar_url) = ''`,
    );

    await queryRunner.query(
      `ALTER TABLE agents ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE agents ALTER COLUMN avatar_url SET DEFAULT '${defaultAvatar}'`,
    );
    await queryRunner.query(
      `UPDATE agents SET avatar_url = '${defaultAvatar}' WHERE avatar_url IS NULL OR BTRIM(avatar_url) = ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE agents DROP COLUMN IF EXISTS avatar_url`,
    );
    await queryRunner.query(
      `ALTER TABLE users DROP COLUMN IF EXISTS avatar_url`,
    );
  }
}
