import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：统一资源表
 * @description 新增 resources 表用于记录上传者、文件元信息、MD5 与存储路径。
 * @keywords-cn 迁移, 资源表, 上传, MD5, 去重
 * @keywords-en migration, resources-table, upload, md5, dedup
 */
export class Resources1769890000000 implements MigrationInterface {
  name = 'Resources1769890000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS resources (
        id CHAR(36) PRIMARY KEY,
        uploader_id CHAR(36),
        original_name VARCHAR(255) NOT NULL,
        file_ext VARCHAR(32),
        mime_type VARCHAR(128),
        file_size BIGINT NOT NULL,
        md5 VARCHAR(64) NOT NULL,
        category VARCHAR(32) NOT NULL,
        storage_path TEXT NOT NULL,
        copied_from_id CHAR(36),
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
      `CREATE INDEX IF NOT EXISTS idx_resources_md5 ON resources(md5)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_resources_uploader ON resources(uploader_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_resources_is_delete ON resources(is_delete)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_resources_created_at ON resources(created_at)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS resources`);
  }
}
