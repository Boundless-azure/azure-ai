import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：移除 domain_bindings 表的 app_id 字段
 * @description 删除 domain_bindings 表中的 app_id 列及相关索引。
 * @keywords-cn 迁移, domain_bindings, 移除app_id
 * @keywords-en migration, domain_bindings, remove-app-id
 */
export class RemoveAppIdFromDomainBindings1774000000003 implements MigrationInterface {
  name = 'RemoveAppIdFromDomainBindings1774000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "domain_bindings" DROP COLUMN IF EXISTS "app_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_domain_bindings_app_id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "domain_bindings" ADD COLUMN IF NOT EXISTS "app_id" varchar(128)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_domain_bindings_app_id"
      ON "domain_bindings" ("app_id")
    `);
  }
}
