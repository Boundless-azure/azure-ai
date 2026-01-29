import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：身份认证模块
 * @description 创建主体、用户、组织、角色、权限、成员关系表
 * @keywords-cn 迁移, 身份, 用户, 组织, 角色, 权限
 * @keywords-en migration, identity, user, organization, role, permission
 */
export class Identity1737200000003 implements MigrationInterface {
  name = 'Identity1737200000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 创建 principal_type enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE principal_type AS ENUM ('system', 'user', 'agent', 'official', 'consumer', 'enterprise');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // principals: 身份主体表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS principals (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        display_name VARCHAR(255) NOT NULL,
        principal_type principal_type NOT NULL,
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
      `CREATE INDEX IF NOT EXISTS idx_principals_type ON principals(principal_type)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_principals_tenant ON principals(tenant_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_principals_email ON principals(email)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_principals_is_delete ON principals(is_delete)`,
    );

    // users: 用户扩展表（密码等敏感信息）
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        principal_id CHAR(36) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255),
        password_salt VARCHAR(64),
        last_login_at TIMESTAMPTZ,
        login_attempts INT DEFAULT 0,
        locked_until TIMESTAMPTZ,
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_users_principal_id ON users(principal_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
    );

    // organizations: 组织表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
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
      `CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_organizations_code ON organizations(code)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_organizations_is_delete ON organizations(is_delete)`,
    );

    // roles: 角色表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
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
      `CREATE INDEX IF NOT EXISTS idx_roles_org ON roles(organization_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_roles_code ON roles(code)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_roles_is_delete ON roles(is_delete)`,
    );

    // role_permissions: 角色权限关联表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
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
      `CREATE INDEX IF NOT EXISTS idx_role_perms_role ON role_permissions(role_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_role_perms_subject ON role_permissions(subject)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_role_perms_action ON role_permissions(action)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_role_perms_is_delete ON role_permissions(is_delete)`,
    );

    // permission_definitions: 权限定义表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS permission_definitions (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        subject VARCHAR(64) NOT NULL,
        action VARCHAR(64) NOT NULL,
        description TEXT,
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_perm_def_subject ON permission_definitions(subject)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_perm_def_action ON permission_definitions(action)`,
    );

    // memberships: 成员关系表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS memberships (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        organization_id CHAR(36) NOT NULL,
        principal_id CHAR(36) NOT NULL,
        role_id CHAR(36),
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
      `CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships(organization_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_memberships_principal ON memberships(principal_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_memberships_role ON memberships(role_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_memberships_is_delete ON memberships(is_delete)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS memberships`);
    await queryRunner.query(`DROP TABLE IF EXISTS permission_definitions`);
    await queryRunner.query(`DROP TABLE IF EXISTS role_permissions`);
    await queryRunner.query(`DROP TABLE IF EXISTS roles`);
    await queryRunner.query(`DROP TABLE IF EXISTS organizations`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`DROP TABLE IF EXISTS principals`);
    await queryRunner.query(`DROP TYPE IF EXISTS principal_type`);
  }
}
