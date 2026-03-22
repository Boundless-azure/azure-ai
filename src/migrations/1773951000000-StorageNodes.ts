import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：创建存储节点表
 * @description 创建 storage_nodes 表用于资源库管理
 * @keywords-cn 迁移, 存储节点, 资源库
 * @keywords-en migration, storage-node, resource-library
 */
export class StorageNodes1773951000000 implements MigrationInterface {
  name = 'StorageNodes1773951000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "storage_nodes" (
        "id" char(36) NOT NULL DEFAULT uuid_generate_v7()::text,
        "created_user" char(36),
        "update_user" char(36),
        "channel_id" varchar(100),
        "is_delete" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMPTZ,
        "tenant_id" char(36) NOT NULL,
        "parent_id" char(36),
        "name" varchar(255) NOT NULL,
        "type" varchar(32) NOT NULL,
        "path" text NOT NULL,
        "size" bigint,
        "mime_type" varchar(128),
        "resource_id" char(36),
        "share_mode" varchar(32) NOT NULL DEFAULT 'none',
        "share_password" varchar(128),
        "share_expires_at" TIMESTAMPTZ,
        "share_token" varchar(64),
        "active" boolean NOT NULL DEFAULT true
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_storage_nodes_tenant_parent" ON "storage_nodes" ("tenant_id", "parent_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_storage_nodes_tenant" ON "storage_nodes" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_storage_nodes_share_token" ON "storage_nodes" ("share_token")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "storage_nodes"`);
  }
}
