import { MigrationInterface, QueryRunner } from 'typeorm';
import { randomBytes, scryptSync } from 'crypto';

/**
 * @title 迁移：Principal 扩展表和 User 表
 * @description 创建 users 表，迁移密码数据，移除 principals 表密码字段，修改 principal_type 为 enum。
 * @keywords-cn 迁移, 用户表, 密码迁移, 枚举
 * @keywords-en migration, users-table, password-migration, enum
 */
export class PrincipalSchemaChanges1768700000000 implements MigrationInterface {
  name = 'PrincipalSchemaChanges1768700000000';

  private getDbType(queryRunner: QueryRunner): string {
    const raw = (queryRunner.connection.options as { type?: unknown }).type;
    return typeof raw === 'string' ? raw : 'mysql';
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const type = this.getDbType(queryRunner);
    const isPg = type === 'postgres';
    const isSqlite = type === 'sqlite';

    // 1. 创建 users 表
    if (isPg) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS users (
          id char(36) PRIMARY KEY,
          principal_id char(36) NOT NULL UNIQUE,
          email varchar(255) NOT NULL UNIQUE,
          password_hash varchar(255) NULL,
          password_salt varchar(64) NULL,
          last_login_at TIMESTAMPTZ NULL,
          login_attempts int DEFAULT 0,
          locked_until TIMESTAMPTZ NULL,
          created_user char(36) NULL,
          update_user char(36) NULL,
          channel_id varchar(100) NULL,
          is_delete boolean DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          deleted_at TIMESTAMPTZ NULL
        )
      `);
    } else if (isSqlite) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS users (
          id char(36) PRIMARY KEY,
          principal_id char(36) NOT NULL UNIQUE,
          email varchar(255) NOT NULL UNIQUE,
          password_hash varchar(255) NULL,
          password_salt varchar(64) NULL,
          last_login_at DATETIME NULL,
          login_attempts int DEFAULT 0,
          locked_until DATETIME NULL,
          created_user char(36) NULL,
          update_user char(36) NULL,
          channel_id varchar(100) NULL,
          is_delete boolean DEFAULT 0,
          created_at DATETIME DEFAULT (datetime('now')),
          updated_at DATETIME DEFAULT (datetime('now')),
          deleted_at DATETIME NULL
        )
      `);
    } else {
      // MySQL
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS users (
          id char(36) PRIMARY KEY,
          principal_id char(36) NOT NULL UNIQUE,
          email varchar(255) NOT NULL UNIQUE,
          password_hash varchar(255) NULL,
          password_salt varchar(64) NULL,
          last_login_at TIMESTAMP NULL,
          login_attempts int DEFAULT 0,
          locked_until TIMESTAMP NULL,
          created_user char(36) NULL,
          update_user char(36) NULL,
          channel_id varchar(100) NULL,
          is_delete boolean DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP NULL
        )
      `);
    }

    // 2. 迁移现有 principals 中的密码数据到 users 表
    const principalsWithPassword = await queryRunner.query(
      isPg
        ? `SELECT id, email, password_hash, password_salt FROM principals WHERE password_hash IS NOT NULL AND email IS NOT NULL`
        : `SELECT id, email, password_hash, password_salt FROM principals WHERE password_hash IS NOT NULL AND email IS NOT NULL`,
    );

    if (Array.isArray(principalsWithPassword)) {
      for (const p of principalsWithPassword) {
        const userId = cryptoId();
        const principalId = p.id as string;
        const email = p.email as string;
        const passwordHash = p.password_hash as string;
        const passwordSalt = p.password_salt as string;

        if (isPg) {
          await queryRunner.query(
            `INSERT INTO users (id, principal_id, email, password_hash, password_salt) VALUES ($1, $2, $3, $4, $5)`,
            [userId, principalId, email, passwordHash, passwordSalt],
          );
        } else {
          await queryRunner.query(
            `INSERT INTO users (id, principal_id, email, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)`,
            [userId, principalId, email, passwordHash, passwordSalt],
          );
        }
      }
    }

    // 3. 移除 principals 表中的密码字段
    if (!isSqlite) {
      if (isPg) {
        await queryRunner.query(
          `ALTER TABLE principals DROP COLUMN IF EXISTS password_hash`,
        );
        await queryRunner.query(
          `ALTER TABLE principals DROP COLUMN IF EXISTS password_salt`,
        );
      } else {
        // MySQL - check if columns exist first
        const columns = await queryRunner.query(
          `SHOW COLUMNS FROM principals LIKE 'password_hash'`,
        );
        if (Array.isArray(columns) && columns.length > 0) {
          await queryRunner.query(
            `ALTER TABLE principals DROP COLUMN password_hash`,
          );
        }
        const saltColumns = await queryRunner.query(
          `SHOW COLUMNS FROM principals LIKE 'password_salt'`,
        );
        if (Array.isArray(saltColumns) && saltColumns.length > 0) {
          await queryRunner.query(
            `ALTER TABLE principals DROP COLUMN password_salt`,
          );
        }
      }
    }

    // 4. 添加 principal_id 到 agents 表
    if (isPg) {
      await queryRunner.query(
        `ALTER TABLE agents ADD COLUMN IF NOT EXISTS principal_id char(36) NULL`,
      );
    } else if (!isSqlite) {
      const agentCols = await queryRunner.query(
        `SHOW COLUMNS FROM agents LIKE 'principal_id'`,
      );
      if (!Array.isArray(agentCols) || agentCols.length === 0) {
        await queryRunner.query(
          `ALTER TABLE agents ADD COLUMN principal_id char(36) NULL`,
        );
      }
    } else {
      await queryRunner.query(
        `ALTER TABLE agents ADD COLUMN principal_id char(36) NULL`,
      );
    }

    // 5. 创建索引
    if (isPg) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_users_principal_id ON users(principal_id)`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_agents_principal_id ON agents(principal_id)`,
      );
    } else if (!isSqlite) {
      // MySQL - 创建索引前先检查
      try {
        await queryRunner.query(
          `CREATE INDEX idx_users_principal_id ON users(principal_id)`,
        );
      } catch (e) {
        /* 索引可能已存在 */
      }
      try {
        await queryRunner.query(`CREATE INDEX idx_users_email ON users(email)`);
      } catch (e) {
        /* 索引可能已存在 */
      }
      try {
        await queryRunner.query(
          `CREATE INDEX idx_agents_principal_id ON agents(principal_id)`,
        );
      } catch (e) {
        /* 索引可能已存在 */
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const type = this.getDbType(queryRunner);
    const isPg = type === 'postgres';
    const isSqlite = type === 'sqlite';

    // 恢复 principals 表的密码字段
    if (isPg) {
      await queryRunner.query(
        `ALTER TABLE principals ADD COLUMN password_hash varchar(255) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE principals ADD COLUMN password_salt varchar(64) NULL`,
      );
    } else if (!isSqlite) {
      await queryRunner.query(
        `ALTER TABLE principals ADD COLUMN password_hash varchar(255) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE principals ADD COLUMN password_salt varchar(64) NULL`,
      );
    }

    // 从 users 表迁移回密码数据
    const users = await queryRunner.query(
      `SELECT principal_id, password_hash, password_salt FROM users`,
    );
    if (Array.isArray(users)) {
      for (const u of users) {
        if (isPg) {
          await queryRunner.query(
            `UPDATE principals SET password_hash = $1, password_salt = $2 WHERE id = $3`,
            [u.password_hash, u.password_salt, u.principal_id],
          );
        } else {
          await queryRunner.query(
            `UPDATE principals SET password_hash = ?, password_salt = ? WHERE id = ?`,
            [u.password_hash, u.password_salt, u.principal_id],
          );
        }
      }
    }

    // 删除 agents 表的 principal_id 列
    if (isPg) {
      await queryRunner.query(
        `ALTER TABLE agents DROP COLUMN IF EXISTS principal_id`,
      );
    } else if (!isSqlite) {
      await queryRunner.query(`ALTER TABLE agents DROP COLUMN principal_id`);
    }

    // 删除 users 表
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
  }
}

function cryptoId(): string {
  const bytes = randomBytes(16);
  const hex = bytes.toString('hex');
  return (
    hex.substring(0, 8) +
    '-' +
    hex.substring(8, 12) +
    '-' +
    hex.substring(12, 16) +
    '-' +
    hex.substring(16, 20) +
    '-' +
    hex.substring(20)
  );
}
