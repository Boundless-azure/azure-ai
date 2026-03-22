import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：向 Plugins 表添加 Solution 字段
 * @description 向 plugins 表添加 source, location, images, includes 字段
 * @keywords-cn 迁移, plugins表, solution字段
 * @keywords-en migration, plugins-table, solution-fields
 */
export class AddSolutionFieldsToPlugins1773972000000 implements MigrationInterface {
  name = 'AddSolutionFieldsToPlugins1773972000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE plugins
        ADD COLUMN IF NOT EXISTS source VARCHAR(32) DEFAULT 'self_developed',
        ADD COLUMN IF NOT EXISTS location VARCHAR(512),
        ADD COLUMN IF NOT EXISTS images JSONB,
        ADD COLUMN IF NOT EXISTS includes JSONB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE plugins
        DROP COLUMN IF EXISTS source,
        DROP COLUMN IF EXISTS location,
        DROP COLUMN IF EXISTS images,
        DROP COLUMN IF EXISTS includes
    `);
  }
}
