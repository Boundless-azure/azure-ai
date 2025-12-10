import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSummaryTable1765387400000 implements MigrationInterface {
  name = 'CreateSummaryTable1765387400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`summary_table\` (
        \`id\` CHAR(36) NOT NULL PRIMARY KEY,
        \`session_id\` VARCHAR(100) NOT NULL,
        \`round_number\` INT NOT NULL,
        \`summary_content\` TEXT NOT NULL,
        \`created_user\` CHAR(36),
        \`update_user\` CHAR(36),
        \`channel_id\` VARCHAR(100),
        \`is_delete\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
        UNIQUE KEY \`UQ_SUMMARY_SESSION_ROUND\` (\`session_id\`, \`round_number\`),
        INDEX \`idx_summary_session\` (\`session_id\`)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `summary_table`');
  }
}
