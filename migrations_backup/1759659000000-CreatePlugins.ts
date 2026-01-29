import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class CreatePlugins1759659000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'plugins',
        columns: [
          {
            name: 'id',
            type: 'char',
            length: '36',
            isPrimary: true,
          },
          { name: 'name', type: 'varchar', length: '255', isNullable: false },
          { name: 'version', type: 'varchar', length: '64', isNullable: false },
          { name: 'description', type: 'text', isNullable: false },
          { name: 'hooks', type: 'text', isNullable: false },
          { name: 'keywords_zh', type: 'text', isNullable: true },
          { name: 'keywords_en', type: 'text', isNullable: true },
          {
            name: 'plugin_dir',
            type: 'varchar',
            length: '512',
            isNullable: false,
          },
          { name: 'registered', type: 'boolean', default: true },
          {
            name: 'created_user',
            type: 'char',
            length: '36',
            isNullable: true,
          },
          { name: 'update_user', type: 'char', length: '36', isNullable: true },
          {
            name: 'channel_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          { name: 'is_delete', type: 'boolean', default: false },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
            default: null,
          },
        ],
        uniques: [
          new TableUnique({
            name: 'UQ_PLUGIN_NAME_VERSION',
            columnNames: ['name', 'version'],
          }),
        ],
        indices: [
          new TableIndex({ name: 'IDX_PLUGIN_NAME', columnNames: ['name'] }),
          new TableIndex({
            name: 'idx_plugins_is_delete',
            columnNames: ['is_delete'],
          }),
          new TableIndex({
            name: 'idx_plugins_channel_id',
            columnNames: ['channel_id'],
          }),
        ],
      }),
      true,
    );

    await queryRunner.query(
      "CREATE INDEX IF NOT EXISTS idx_plugins_ft ON plugins USING GIN (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(keywords_zh, '') || ' ' || coalesce(keywords_en, '')))",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_plugins_ft');
    await queryRunner.dropTable('plugins', true);
  }
}
