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
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
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
            name: 'created_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
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
        ],
      }),
      true,
    );

    // MySQL FULLTEXT 索引（TypeORM 提供 isFulltext，但为兼容不同版本，这里直接使用原始 SQL）
    await queryRunner.query(
      'CREATE FULLTEXT INDEX IDX_PLUGINS_FT ON plugins (name, description, keywords_zh, keywords_en)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IDX_PLUGINS_FT ON plugins');
    await queryRunner.dropTable('plugins', true);
  }
}
