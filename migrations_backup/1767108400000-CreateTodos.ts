import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTodos1767108400000 implements MigrationInterface {
  name = 'CreateTodos1767108400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id CHAR(36) PRIMARY KEY,
        initiator_id CHAR(36) NOT NULL,
        title VARCHAR(255) NOT NULL,
        plugin_id CHAR(36) NULL,
        description TEXT NULL,
        action JSONB NULL,
        recipient_id CHAR(36) NOT NULL,
        status VARCHAR(32) NOT NULL,
        receipt JSONB NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_user CHAR(36) NULL,
        update_user CHAR(36) NULL,
        channel_id VARCHAR(100) NULL,
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ NULL
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_todos_initiator ON todos (initiator_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_todos_recipient ON todos (recipient_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_todos_status ON todos (status)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS todos');
  }
}
