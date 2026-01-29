import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIdentityTables1767500000000 implements MigrationInterface {
  name = 'CreateIdentityTables1767500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS principals (
        id CHAR(36) PRIMARY KEY,
        display_name VARCHAR(255) NOT NULL,
        principal_type VARCHAR(32) NOT NULL,
        avatar_url VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(64),
        tenant_id CHAR(36),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_principals_type ON principals (principal_type)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_principals_tenant ON principals (tenant_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_principals_is_delete ON principals (is_delete)',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(64),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations (name)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_organizations_is_delete ON organizations (is_delete)',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(64) NOT NULL,
        description TEXT,
        organization_id CHAR(36),
        builtin BOOLEAN NOT NULL DEFAULT FALSE,
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_roles_org ON roles (organization_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_roles_code ON roles (code)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_roles_is_delete ON roles (is_delete)',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id CHAR(36) PRIMARY KEY,
        role_id CHAR(36) NOT NULL,
        subject VARCHAR(64) NOT NULL,
        action VARCHAR(64) NOT NULL,
        conditions JSONB,
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_role_perms_role ON role_permissions (role_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_role_perms_subject ON role_permissions (subject)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_role_perms_action ON role_permissions (action)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_role_perms_is_delete ON role_permissions (is_delete)',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS memberships (
        id CHAR(36) PRIMARY KEY,
        organization_id CHAR(36) NOT NULL,
        principal_id CHAR(36) NOT NULL,
        role VARCHAR(32) NOT NULL,
        department VARCHAR(255),
        tags JSONB,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships (organization_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_memberships_principal ON memberships (principal_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_memberships_role ON memberships (role)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_memberships_is_delete ON memberships (is_delete)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS memberships');
    await queryRunner.query('DROP TABLE IF EXISTS role_permissions');
    await queryRunner.query('DROP TABLE IF EXISTS roles');
    await queryRunner.query('DROP TABLE IF EXISTS organizations');
    await queryRunner.query('DROP TABLE IF EXISTS principals');
  }
}
