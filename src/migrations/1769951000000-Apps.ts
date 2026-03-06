import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：Apps 与 AppUnit
 * @description 将 plugins 表演进为 apps，并新增 app_units（支持 session 关联、向量与关键词字段）。
 * @keywords-cn 迁移, apps, app-unit, session_id, 向量, 关键词
 * @keywords-en migration, apps, app-unit, session_id, embedding, keywords
 */
export class Apps1769951000000 implements MigrationInterface {
  name = 'Apps1769951000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.plugins') IS NOT NULL AND to_regclass('public.apps') IS NULL THEN
          EXECUTE 'ALTER TABLE public.plugins RENAME TO apps';
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS apps
        ADD COLUMN IF NOT EXISTS session_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS hooks TEXT,
        ADD COLUMN IF NOT EXISTS keywords_zh TEXT,
        ADD COLUMN IF NOT EXISTS keywords_en TEXT,
        ADD COLUMN IF NOT EXISTS plugin_dir VARCHAR(512),
        ADD COLUMN IF NOT EXISTS registered BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS embedding vector(1536),
        ADD COLUMN IF NOT EXISTS keywords JSONB
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_apps_session_id ON apps(session_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_apps_name ON apps(name)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_apps_name_version ON apps(name, version)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS app_units (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        session_id VARCHAR(100),
        app_id CHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        version VARCHAR(64),
        description TEXT,
        embedding vector(1536),
        keywords JSONB,
        keywords_zh TEXT,
        keywords_en TEXT,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ,
        CONSTRAINT fk_app_units_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
        CONSTRAINT uq_app_units_app_id_name UNIQUE (app_id, name)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_app_units_session_id ON app_units(session_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_app_units_app_id ON app_units(app_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_app_units_name ON app_units(name)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_app_units_is_delete ON app_units(is_delete)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS app_units`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.apps') IS NOT NULL AND to_regclass('public.plugins') IS NULL THEN
          EXECUTE 'ALTER TABLE public.apps RENAME TO plugins';
        END IF;
      END$$;
    `);
  }
}
