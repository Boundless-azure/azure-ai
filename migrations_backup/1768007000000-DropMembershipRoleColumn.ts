import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropMembershipRoleColumn1768007000000 implements MigrationInterface {
  name = 'DropMembershipRoleColumn1768007000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Only PostgreSQL
    await queryRunner.query('DROP INDEX IF EXISTS idx_memberships_role');
    await queryRunner.query('ALTER TABLE memberships DROP COLUMN role');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore column for rollback (PostgreSQL)
    await queryRunner.query(
      "ALTER TABLE memberships ADD COLUMN role varchar(32) NOT NULL DEFAULT 'admin'",
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_memberships_role ON memberships (role)',
    );
  }
}
