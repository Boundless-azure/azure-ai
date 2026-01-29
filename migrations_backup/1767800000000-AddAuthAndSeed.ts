import { MigrationInterface, QueryRunner } from 'typeorm';
import { randomBytes, scryptSync } from 'crypto';

export class AddAuthAndSeed1767800000000 implements MigrationInterface {
  name = 'AddAuthAndSeed1767800000000';

  private nowExpr(type: string): string {
    return type === 'sqlite' ? "datetime('now')" : 'NOW()';
  }

  private getDbType(queryRunner: QueryRunner): string {
    const raw = (
      queryRunner.connection.options as unknown as { type?: unknown }
    ).type;
    return typeof raw === 'string' ? raw : 'mysql';
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const type = this.getDbType(queryRunner);
    const now = this.nowExpr(type);

    if (type === 'sqlite') {
      await queryRunner.query(
        'ALTER TABLE principals ADD COLUMN password_hash varchar(255) NULL',
      );
      await queryRunner.query(
        'ALTER TABLE principals ADD COLUMN password_salt varchar(64) NULL',
      );
    } else if (type === 'postgres') {
      await queryRunner.query(
        'ALTER TABLE principals ADD COLUMN password_hash varchar(255) NULL',
      );
      await queryRunner.query(
        'ALTER TABLE principals ADD COLUMN password_salt varchar(64) NULL',
      );
    } else {
      await queryRunner.query(
        'ALTER TABLE principals ADD COLUMN `password_hash` varchar(255) NULL',
      );
      await queryRunner.query(
        'ALTER TABLE principals ADD COLUMN `password_salt` varchar(64) NULL',
      );
    }

    if (type === 'sqlite') {
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS permission_definitions (
          id char(36) PRIMARY KEY,
          subject varchar(64) NOT NULL,
          action varchar(64) NOT NULL,
          description text NULL,
          created_user char(36) NULL,
          update_user char(36) NULL,
          channel_id varchar(100) NULL,
          is_delete boolean DEFAULT 0,
          created_at DATETIME DEFAULT (datetime('now')),
          updated_at DATETIME DEFAULT (datetime('now')),
          deleted_at DATETIME NULL
        )
        `,
      );
    } else if (type === 'postgres') {
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS permission_definitions (
          id char(36) PRIMARY KEY,
          subject varchar(64) NOT NULL,
          action varchar(64) NOT NULL,
          description text NULL,
          created_user char(36) NULL,
          update_user char(36) NULL,
          channel_id varchar(100) NULL,
          is_delete boolean DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT ${now},
          updated_at TIMESTAMPTZ DEFAULT ${now},
          deleted_at TIMESTAMPTZ NULL
        )
        `,
      );
    } else {
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS permission_definitions (
          id char(36) PRIMARY KEY,
          subject varchar(64) NOT NULL,
          action varchar(64) NOT NULL,
          description text NULL,
          created_user char(36) NULL,
          update_user char(36) NULL,
          channel_id varchar(100) NULL,
          is_delete boolean DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP NULL
        )
        `,
      );
    }

    const orgId = cryptoId();
    if (type === 'postgres') {
      await queryRunner.query(
        'INSERT INTO organizations (id, name, code, active) VALUES ($1, $2, $3, $4)',
        [orgId, 'Default Org', 'default', true],
      );
    } else {
      await queryRunner.query(
        'INSERT INTO organizations (id, name, code, active) VALUES (?, ?, ?, ?)',
        [orgId, 'Default Org', 'default', 1],
      );
    }

    const adminId = cryptoId();
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync('admin123', salt, 32).toString('hex');
    if (type === 'postgres') {
      await queryRunner.query(
        'INSERT INTO principals (id, display_name, principal_type, avatar_url, email, phone, tenant_id, active, password_hash, password_salt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [
          adminId,
          'Administrator',
          'system',
          null,
          'admin@example.com',
          null,
          orgId,
          true,
          hash,
          salt,
        ],
      );
    } else {
      await queryRunner.query(
        'INSERT INTO principals (id, display_name, principal_type, avatar_url, email, phone, tenant_id, active, password_hash, password_salt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          adminId,
          'Administrator',
          'system',
          null,
          'admin@example.com',
          null,
          orgId,
          1,
          hash,
          salt,
        ],
      );
    }

    const roleId = cryptoId();
    if (type === 'postgres') {
      await queryRunner.query(
        'INSERT INTO roles (id, name, code, description, organization_id, builtin) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          roleId,
          'Administrator',
          'admin',
          'System administrator role',
          orgId,
          true,
        ],
      );
    } else {
      await queryRunner.query(
        'INSERT INTO roles (id, name, code, description, organization_id, builtin) VALUES (?, ?, ?, ?, ?, ?)',
        [
          roleId,
          'Administrator',
          'admin',
          'System administrator role',
          orgId,
          1,
        ],
      );
    }

    const permId = cryptoId();
    if (type === 'postgres') {
      await queryRunner.query(
        'INSERT INTO role_permissions (id, role_id, subject, action, conditions) VALUES ($1, $2, $3, $4, $5)',
        [permId, roleId, '*', 'manage', null],
      );
    } else {
      await queryRunner.query(
        'INSERT INTO role_permissions (id, role_id, subject, action, conditions) VALUES (?, ?, ?, ?, ?)',
        [permId, roleId, '*', 'manage', null],
      );
    }

    const memId = cryptoId();
    if (type === 'postgres') {
      await queryRunner.query(
        'INSERT INTO memberships (id, organization_id, principal_id, role, department, tags, active) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [memId, orgId, adminId, 'owner', null, null, true],
      );
    } else {
      await queryRunner.query(
        'INSERT INTO memberships (id, organization_id, principal_id, role, department, tags, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [memId, orgId, adminId, 'owner', null, null, 1],
      );
    }

    const defs: Array<[string, string]> = [
      ['principal', 'read'],
      ['principal', 'create'],
      ['principal', 'update'],
      ['principal', 'delete'],
      ['organization', 'read'],
      ['organization', 'create'],
      ['organization', 'update'],
      ['organization', 'delete'],
      ['role', 'read'],
      ['role', 'create'],
      ['role', 'update'],
      ['role', 'delete'],
      ['role_permission', 'read'],
      ['role_permission', 'update'],
      ['membership', 'read'],
      ['membership', 'create'],
      ['membership', 'delete'],
      ['permission_definition', 'read'],
      ['permission_definition', 'create'],
      ['permission_definition', 'delete'],
    ];
    for (const [subject, action] of defs) {
      const id = cryptoId();
      if (type === 'postgres') {
        await queryRunner.query(
          'INSERT INTO permission_definitions (id, subject, action, description) VALUES ($1, $2, $3, $4)',
          [id, subject, action, null],
        );
      } else {
        await queryRunner.query(
          'INSERT INTO permission_definitions (id, subject, action, description) VALUES (?, ?, ?, ?)',
          [id, subject, action, null],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const type = this.getDbType(queryRunner);
    await queryRunner.query('DELETE FROM memberships');
    await queryRunner.query('DELETE FROM role_permissions');
    await queryRunner.query('DELETE FROM roles');
    await queryRunner.query('DELETE FROM principals');
    await queryRunner.query('DELETE FROM organizations');
    await queryRunner.query('DELETE FROM permission_definitions');
    if (type === 'sqlite') {
      void 0;
    } else if (type === 'postgres') {
      await queryRunner.query('DROP TABLE IF EXISTS permission_definitions');
      await queryRunner.query(
        'ALTER TABLE principals DROP COLUMN password_hash',
      );
      await queryRunner.query(
        'ALTER TABLE principals DROP COLUMN password_salt',
      );
    } else {
      await queryRunner.query('DROP TABLE IF EXISTS permission_definitions');
      await queryRunner.query(
        'ALTER TABLE principals DROP COLUMN `password_hash`',
      );
      await queryRunner.query(
        'ALTER TABLE principals DROP COLUMN `password_salt`',
      );
    }
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
