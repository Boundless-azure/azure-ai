import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：为 frp_records 表添加审计字段
 * @description 为 frp_records 表添加 BaseAuditedEntity 所需的审计字段。
 * @keywords-cn 迁移, frp_records, 审计字段, created_user, update_user
 * @keywords-en migration, frp_records, audit columns, created_user, update_user
 */
export class AddMissingAuditColumnsToFrpRecords1774000000001 implements MigrationInterface {
  name = 'AddMissingAuditColumnsToFrpRecords1774000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "frp_records"
      ADD COLUMN IF NOT EXISTS "created_user" char(36),
      ADD COLUMN IF NOT EXISTS "update_user" char(36),
      ADD COLUMN IF NOT EXISTS "channel_id" varchar(100),
      ADD COLUMN IF NOT EXISTS "is_delete" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz
    `);

    await queryRunner.query(`
      ALTER TABLE "domain_bindings"
      ADD COLUMN IF NOT EXISTS "created_user" char(36),
      ADD COLUMN IF NOT EXISTS "update_user" char(36),
      ADD COLUMN IF NOT EXISTS "channel_id" varchar(100),
      ADD COLUMN IF NOT EXISTS "is_delete" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "domain_bindings"
      DROP COLUMN IF EXISTS "deleted_at",
      DROP COLUMN IF EXISTS "is_delete",
      DROP COLUMN IF EXISTS "channel_id",
      DROP COLUMN IF EXISTS "update_user",
      DROP COLUMN IF EXISTS "created_user"
    `);

    await queryRunner.query(`
      ALTER TABLE "frp_records"
      DROP COLUMN IF EXISTS "deleted_at",
      DROP COLUMN IF EXISTS "is_delete",
      DROP COLUMN IF EXISTS "channel_id",
      DROP COLUMN IF EXISTS "update_user",
      DROP COLUMN IF EXISTS "created_user"
    `);
  }
}
