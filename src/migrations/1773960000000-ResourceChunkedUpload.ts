import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：资源表新增分片上传和SHA256字段
 * @description 为 resources 表添加 sha256、sha256_sampled、chunk_total、chunk_bitmap、chunk_temp_dir、chunk_expires_at 字段，支持分片上传和断点续传。
 * @keywords-cn 迁移, 资源表, 分片上传, SHA256, 断点续传
 * @keywords-en migration, resources-table, chunked-upload, sha256, resume
 */
export class ResourceChunkedUpload1773960000000 implements MigrationInterface {
  name = 'ResourceChunkedUpload1773960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 新增 SHA256 字段
    await queryRunner.query(`
      ALTER TABLE resources
      ADD COLUMN IF NOT EXISTS sha256 VARCHAR(64)
    `);

    // 新增抽样标识
    await queryRunner.query(`
      ALTER TABLE resources
      ADD COLUMN IF NOT EXISTS sha256_sampled BOOLEAN NOT NULL DEFAULT FALSE
    `);

    // 新增分片总数
    await queryRunner.query(`
      ALTER TABLE resources
      ADD COLUMN IF NOT EXISTS chunk_total INT NOT NULL DEFAULT 0
    `);

    // 新增分片位图
    await queryRunner.query(`
      ALTER TABLE resources
      ADD COLUMN IF NOT EXISTS chunk_bitmap VARCHAR(128) NOT NULL DEFAULT ''
    `);

    // 新增临时分片目录
    await queryRunner.query(`
      ALTER TABLE resources
      ADD COLUMN IF NOT EXISTS chunk_temp_dir VARCHAR(512)
    `);

    // 新增分片过期时间
    await queryRunner.query(`
      ALTER TABLE resources
      ADD COLUMN IF NOT EXISTS chunk_expires_at TIMESTAMPTZ
    `);

    // 新增 SHA256 索引
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_resources_sha256 ON resources(sha256)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_resources_sha256`);
    await queryRunner.query(`
      ALTER TABLE resources DROP COLUMN IF EXISTS sha256
    `);
    await queryRunner.query(`
      ALTER TABLE resources DROP COLUMN IF EXISTS sha256_sampled
    `);
    await queryRunner.query(`
      ALTER TABLE resources DROP COLUMN IF EXISTS chunk_total
    `);
    await queryRunner.query(`
      ALTER TABLE resources DROP COLUMN IF EXISTS chunk_bitmap
    `);
    await queryRunner.query(`
      ALTER TABLE resources DROP COLUMN IF EXISTS chunk_temp_dir
    `);
    await queryRunner.query(`
      ALTER TABLE resources DROP COLUMN IF EXISTS chunk_expires_at
    `);
  }
}
