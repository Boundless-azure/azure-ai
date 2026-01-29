import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSummaryTable1765387400000 implements MigrationInterface {
  name = 'CreateSummaryTable1765387400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS summary_table (
        id CHAR(36) NOT NULL PRIMARY KEY,
        session_id VARCHAR(100) NOT NULL,
        round_number INT NOT NULL,
        summary_content TEXT NOT NULL,
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ,
        CONSTRAINT "UQ_SUMMARY_SESSION_ROUND" UNIQUE (session_id, round_number)
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_summary_session ON summary_table (session_id)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS summary_table');
  }
}
