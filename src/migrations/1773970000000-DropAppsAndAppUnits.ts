import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：删除 Apps 与 AppUnits 表
 * @description 删除之前创建的 apps 和 app_units 表，恢复原 plugins 表或删除新建的表
 * @keywords-cn 迁移, 删除表, apps, app_units
 * @keywords-en migration, drop-table, apps, app_units
 */
export class DropAppsAndAppUnits1773970000000 implements MigrationInterface {
  name = 'DropAppsAndAppUnits1773970000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 先删除 app_units 表 (有外键依赖)
    await queryRunner.query(`DROP TABLE IF EXISTS app_units`);

    // 2. 检查 apps 表是否存在
    const appsTableExists: Array<{ exists: string | null }> =
      await queryRunner.query(`
        SELECT to_regclass('public.apps') AS exists
      `);

    if (appsTableExists[0]?.exists) {
      // 检查 plugins 表是否已存在（可能被重命名过）
      const pluginsTableExists: Array<{ exists: string | null }> =
        await queryRunner.query(`
          SELECT to_regclass('public.plugins') AS exists
        `);

      if (pluginsTableExists[0]?.exists) {
        // 如果 plugins 也存在，直接删除 apps
        await queryRunner.query(`DROP TABLE IF EXISTS apps`);
      } else {
        // 如果 plugins 不存在，将 apps 重命名回 plugins
        await queryRunner.query(`
          DO $$
          BEGIN
            IF to_regclass('public.apps') IS NOT NULL THEN
              EXECUTE 'ALTER TABLE public.apps RENAME TO plugins';
            END IF;
          END$$;
        `);
      }
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // 此迁移不可逆，不提供回滚
    // 如需回滚，请手动恢复表结构
  }
}
