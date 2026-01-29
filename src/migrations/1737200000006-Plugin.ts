import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：插件模块
 * @description 创建插件注册表
 * @keywords-cn 迁移, 插件, 工具
 * @keywords-en migration, plugin, tool
 */
export class Plugin1737200000006 implements MigrationInterface {
  name = 'Plugin1737200000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // plugins: 插件注册表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS plugins (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        name VARCHAR(100) NOT NULL,
        display_name VARCHAR(200),
        description TEXT,
        category VARCHAR(50),
        version VARCHAR(20),
        config JSONB,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
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
      `CREATE INDEX IF NOT EXISTS idx_plugins_name ON plugins(name)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_plugins_category ON plugins(category)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_plugins_enabled ON plugins(enabled)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_plugins_is_delete ON plugins(is_delete)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS plugins`);
  }
}
