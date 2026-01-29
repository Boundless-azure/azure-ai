import { MigrationInterface, QueryRunner } from 'typeorm';
import { randomBytes } from 'crypto';

export class AlterMembershipRoleRef1768006000000 implements MigrationInterface {
  name = 'AlterMembershipRoleRef1768006000000';

  private getDbType(queryRunner: QueryRunner): string {
    const raw = (
      queryRunner.connection.options as unknown as { type?: unknown }
    ).type;
    return typeof raw === 'string' ? raw : 'mysql';
  }

  private nowExpr(type: string): string {
    return type === 'sqlite' ? "datetime('now')" : 'NOW()';
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const type = this.getDbType(queryRunner);
    const now = this.nowExpr(type);

    // 1) Add role_id column (nullable initially) and index
    if (type === 'sqlite') {
      await queryRunner.query(
        'ALTER TABLE memberships ADD COLUMN role_id char(36) NULL',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_memberships_role_id ON memberships(role_id)',
      );
    } else if (type === 'postgres') {
      await queryRunner.query(
        'ALTER TABLE memberships ADD COLUMN role_id char(36) NULL',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_memberships_role_id ON memberships(role_id)',
      );
      await queryRunner.query(
        'ALTER TABLE memberships ADD CONSTRAINT fk_memberships_role_id FOREIGN KEY (role_id) REFERENCES roles(id)',
      );
    } else {
      await queryRunner.query(
        'ALTER TABLE memberships ADD COLUMN role_id char(36) NULL',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_memberships_role_id ON memberships(role_id)',
      );
      await queryRunner.query(
        'ALTER TABLE memberships ADD CONSTRAINT fk_memberships_role_id FOREIGN KEY (role_id) REFERENCES roles(id)',
      );
    }

    // 2) Ensure admin/guest roles exist and get IDs
    const adminId = await this.ensureRole(
      queryRunner,
      'Administrator',
      'admin',
      null,
      true,
      now,
    );
    const guestId = await this.ensureRole(
      queryRunner,
      '游客',
      'guest',
      null,
      true,
      now,
    );

    // 3) Map legacy role string to role_id
    if (type === 'postgres') {
      await queryRunner.query(
        'UPDATE memberships SET role_id = $1 WHERE role IN ($2, $3)',
        [adminId, 'owner', 'admin'],
      );
      await queryRunner.query(
        'UPDATE memberships SET role_id = $1 WHERE role = $2',
        [guestId, 'member'],
      );
      // Normalize legacy 'owner' -> 'admin'
      await queryRunner.query(
        'UPDATE memberships SET role = $1 WHERE role = $2',
        ['admin', 'owner'],
      );
      // Optional: set default role string to admin
      await queryRunner.query(
        "ALTER TABLE memberships ALTER COLUMN role SET DEFAULT 'admin'",
      );
    } else if (type === 'sqlite') {
      await queryRunner.query(
        'UPDATE memberships SET role_id = ? WHERE role IN (?, ?)',
        [adminId, 'owner', 'admin'],
      );
      await queryRunner.query(
        'UPDATE memberships SET role_id = ? WHERE role = ?',
        [guestId, 'member'],
      );
      await queryRunner.query(
        'UPDATE memberships SET role = ? WHERE role = ?',
        ['admin', 'owner'],
      );
      // sqlite alter default skipped
    } else {
      await queryRunner.query(
        'UPDATE memberships SET role_id = ? WHERE role IN (?, ?)',
        [adminId, 'owner', 'admin'],
      );
      await queryRunner.query(
        'UPDATE memberships SET role_id = ? WHERE role = ?',
        [guestId, 'member'],
      );
      await queryRunner.query(
        'UPDATE memberships SET role = ? WHERE role = ?',
        ['admin', 'owner'],
      );
      // Set default for role string to admin
      await queryRunner.query(
        "ALTER TABLE memberships MODIFY COLUMN role varchar(32) NOT NULL DEFAULT 'admin'",
      );
    }

    // 4) Make role_id NOT NULL for future inserts where possible
    if (type === 'postgres') {
      await queryRunner.query(
        'ALTER TABLE memberships ALTER COLUMN role_id SET NOT NULL',
      );
    } else if (type !== 'sqlite') {
      await queryRunner.query(
        'ALTER TABLE memberships MODIFY COLUMN role_id char(36) NOT NULL',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const type = this.getDbType(queryRunner);
    // Revert role_id changes
    if (type === 'postgres') {
      await queryRunner.query(
        'ALTER TABLE memberships DROP CONSTRAINT IF EXISTS fk_memberships_role_id',
      );
      await queryRunner.query('ALTER TABLE memberships DROP COLUMN role_id');
      await queryRunner.query(
        'ALTER TABLE memberships ALTER COLUMN role DROP DEFAULT',
      );
    } else if (type === 'sqlite') {
      // sqlite cannot drop columns easily; skipping down migration for role_id
      void 0;
    } else {
      await queryRunner.query(
        'ALTER TABLE memberships DROP FOREIGN KEY fk_memberships_role_id',
      );
      await queryRunner.query('ALTER TABLE memberships DROP COLUMN role_id');
      await queryRunner.query(
        'ALTER TABLE memberships MODIFY COLUMN role varchar(32) NOT NULL',
      );
    }
  }

  private async ensureRole(
    queryRunner: QueryRunner,
    name: string,
    code: string,
    organizationId: string | null,
    builtin: boolean,
    nowExpr: string,
  ): Promise<string> {
    const type = this.getDbType(queryRunner);
    const existsSql =
      type === 'postgres'
        ? 'SELECT id FROM roles WHERE code = $1 AND is_delete = false LIMIT 1'
        : 'SELECT id FROM roles WHERE code = ? AND is_delete = 0 LIMIT 1';
    const rows: Array<{ id?: unknown }> = await queryRunner.query(existsSql, [
      code,
    ]);
    if (Array.isArray(rows) && rows.length > 0) {
      const row = rows[0];
      const existingId = typeof row?.id === 'string' ? row.id : undefined;
      if (existingId) return existingId;
    }
    const id = cryptoId();
    if (type === 'postgres') {
      await queryRunner.query(
        `INSERT INTO roles (id, name, code, description, organization_id, builtin, created_user, update_user, channel_id, is_delete, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, NULL, FALSE, ${nowExpr}, ${nowExpr})`,
        [id, name, code, null, organizationId, builtin],
      );
    } else {
      await queryRunner.query(
        `INSERT INTO roles (id, name, code, description, organization_id, builtin, created_user, update_user, channel_id, is_delete, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, ${nowExpr}, ${nowExpr})`,
        [id, name, code, null, organizationId, builtin ? 1 : 0],
      );
    }
    return id;
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
