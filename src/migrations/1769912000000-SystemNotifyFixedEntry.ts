import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：系统通知固定入口
 * @description 初始化系统通知固定入口：创建固定 Principal `ai-notify`，并创建固定会话 `chat_sessions.session_id = ai-notify`。
 * @keywords-cn 迁移, 系统通知, 固定入口, ai-notify, 会话
 * @keywords-en migration, system-notify, fixed-entry, ai-notify, session
 */
export class SystemNotifyFixedEntry1769912000000 implements MigrationInterface {
  name = 'SystemNotifyFixedEntry1769912000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const principalId = 'ai-notify';
    const displayName = '系统通知';

    await queryRunner.query(
      `INSERT INTO principals (id, display_name, principal_type, active)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           principal_type = EXCLUDED.principal_type,
           active = EXCLUDED.active`,
      [principalId, displayName, 'system', true],
    );

    await queryRunner.query(
      `INSERT INTO chat_sessions (session_id, name, type, creator_id, avatar_url, description, active, is_delete)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (session_id) DO UPDATE
       SET name = EXCLUDED.name,
           type = EXCLUDED.type,
           creator_id = EXCLUDED.creator_id,
           avatar_url = EXCLUDED.avatar_url,
           description = EXCLUDED.description,
           active = EXCLUDED.active,
           is_delete = EXCLUDED.is_delete`,
      [
        principalId,
        displayName,
        'channel',
        principalId,
        null,
        '系统通知固定入口',
        true,
        false,
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const principalId = 'ai-notify';
    await queryRunner.query(`DELETE FROM chat_sessions WHERE session_id = $1`, [
      principalId,
    ]);
    await queryRunner.query(`DELETE FROM principals WHERE id = $1`, [
      principalId,
    ]);
  }
}
