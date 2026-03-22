import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：创建插件表
 * @description 根据 PluginEntity 创建 plugins 表
 * @keywords-cn 迁移, 插件, 表结构
 * @keywords-en migration, plugin, table-schema
 */
export class PluginTable1773942000000 implements MigrationInterface {
  name = 'PluginTable1773942000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create plugins table based on PluginEntity
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "plugins" (
        "id" char(36) NOT NULL DEFAULT uuid_generate_v7()::text,
        "created_user" char(36),
        "update_user" char(36),
        "channel_id" varchar(100),
        "is_delete" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMPTZ,
        "runner_id" char(36),
        "tenant_id" char(36),
        "name" varchar(255) NOT NULL,
        "version" varchar(64) NOT NULL,
        "summary" varchar(500),
        "description" text,
        "icon_url" varchar(512),
        "tags" json,
        "author_name" varchar(128),
        "author_id" char(36),
        "markdown_content" text,
        "plugin_dir" varchar(512),
        "install_count" int NOT NULL DEFAULT 0,
        "rating" decimal(3,2) NOT NULL DEFAULT 0,
        "status" varchar(32) NOT NULL DEFAULT 'active',
        "is_published" boolean NOT NULL DEFAULT false,
        "is_installed" boolean NOT NULL DEFAULT false,
        CONSTRAINT "UQ_PLUGIN_NAME_VERSION" UNIQUE ("name", "version")
      )
    `);

    // Create indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_plugins_tenant_id" ON "plugins" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_plugins_name" ON "plugins" ("name")`,
    );
    // Note: tags is JSON type, no B-tree index needed
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "plugins"`);
  }
}
