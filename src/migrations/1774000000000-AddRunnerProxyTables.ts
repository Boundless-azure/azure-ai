import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRunnerProxyTables1774000000000 implements MigrationInterface {
  name = 'AddRunnerProxyTables1774000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 创建 frp_records 表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "frp_records" (
        "id" char(36) NOT NULL DEFAULT uuid_generate_v7()::text,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "runner_id" char(36) NOT NULL,
        "domain" varchar(255) NOT NULL,
        "frp_node_addr" varchar(255) NOT NULL DEFAULT 'default',
        "port" int NOT NULL UNIQUE,
        "frps_port" int NOT NULL DEFAULT 7000,
        "active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_frp_records" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_frp_records_runner_id" ON "frp_records" ("runner_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_frp_records_port" ON "frp_records" ("port")
    `);

    // 创建 domain_bindings 表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "domain_bindings" (
        "id" char(36) NOT NULL DEFAULT uuid_generate_v7()::text,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "domain" varchar(255) NOT NULL UNIQUE,
        "runner_id" char(36) NOT NULL,
        "tenant_id" char(36) NOT NULL,
        "app_id" varchar(128),
        "path_pattern" varchar(500) NOT NULL DEFAULT '.*',
        "active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_domain_bindings" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_domain_bindings_runner_id" ON "domain_bindings" ("runner_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_domain_bindings_app_id" ON "domain_bindings" ("app_id")
    `);

    // 为 runners 表添加 frp_port 和 frp_enabled 字段
    await queryRunner.query(`
      ALTER TABLE "runners" ADD COLUMN IF NOT EXISTS "frp_port" int
    `);

    await queryRunner.query(`
      ALTER TABLE "runners" ADD COLUMN IF NOT EXISTS "frp_enabled" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "domain_bindings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "frp_records"`);
    await queryRunner.query(`ALTER TABLE "runners" DROP COLUMN IF EXISTS "frp_port"`);
    await queryRunner.query(`ALTER TABLE "runners" DROP COLUMN IF EXISTS "frp_enabled"`);
  }
}
