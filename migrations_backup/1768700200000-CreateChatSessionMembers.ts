import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：会话成员表
 * @description 创建 chat_session_members 表用于管理群聊/私聊成员。
 * @keywords-cn 迁移, 会话成员, 群聊, 私聊
 * @keywords-en migration, session-members, group, dm
 */
export class CreateChatSessionMembers1768700200000 implements MigrationInterface {
  name = 'CreateChatSessionMembers1768700200000';

  private getDbType(queryRunner: QueryRunner): string {
    const raw = (queryRunner.connection.options as { type?: unknown }).type;
    return typeof raw === 'string' ? raw : 'mysql';
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const type = this.getDbType(queryRunner);
    const isPg = type === 'postgres';
    const isSqlite = type === 'sqlite';

    if (isPg) {
      // 创建 enum 类型
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE chat_member_role AS ENUM ('owner', 'admin', 'member');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS chat_session_members (
          id char(36) PRIMARY KEY,
          session_id char(36) NOT NULL,
          principal_id char(36) NOT NULL,
          role chat_member_role DEFAULT 'member',
          joined_at TIMESTAMPTZ NULL,
          muted_until TIMESTAMPTZ NULL,
          last_read_at TIMESTAMPTZ NULL,
          last_read_message_id char(36) NULL,
          created_user char(36) NULL,
          update_user char(36) NULL,
          channel_id varchar(100) NULL,
          is_delete boolean DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          deleted_at TIMESTAMPTZ NULL,
          UNIQUE(session_id, principal_id)
        )
      `);

      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_csm_session_id ON chat_session_members(session_id)`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_csm_principal_id ON chat_session_members(principal_id)`,
      );
    } else if (isSqlite) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS chat_session_members (
          id char(36) PRIMARY KEY,
          session_id char(36) NOT NULL,
          principal_id char(36) NOT NULL,
          role varchar(20) DEFAULT 'member',
          joined_at DATETIME NULL,
          muted_until DATETIME NULL,
          last_read_at DATETIME NULL,
          last_read_message_id char(36) NULL,
          created_user char(36) NULL,
          update_user char(36) NULL,
          channel_id varchar(100) NULL,
          is_delete boolean DEFAULT 0,
          created_at DATETIME DEFAULT (datetime('now')),
          updated_at DATETIME DEFAULT (datetime('now')),
          deleted_at DATETIME NULL,
          UNIQUE(session_id, principal_id)
        )
      `);
    } else {
      // MySQL
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS chat_session_members (
          id char(36) PRIMARY KEY,
          session_id char(36) NOT NULL,
          principal_id char(36) NOT NULL,
          role ENUM('owner', 'admin', 'member') DEFAULT 'member',
          joined_at TIMESTAMP NULL,
          muted_until TIMESTAMP NULL,
          last_read_at TIMESTAMP NULL,
          last_read_message_id char(36) NULL,
          created_user char(36) NULL,
          update_user char(36) NULL,
          channel_id varchar(100) NULL,
          is_delete boolean DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP NULL,
          UNIQUE KEY unique_session_principal (session_id, principal_id)
        )
      `);

      try {
        await queryRunner.query(
          `CREATE INDEX idx_csm_session_id ON chat_session_members(session_id)`,
        );
        await queryRunner.query(
          `CREATE INDEX idx_csm_principal_id ON chat_session_members(principal_id)`,
        );
      } catch (e) {
        /* 索引可能已存在 */
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS chat_session_members`);
  }
}
