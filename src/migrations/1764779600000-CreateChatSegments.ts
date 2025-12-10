import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatSegments1764779600000 implements MigrationInterface {
  name = 'CreateChatSegments1764779600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`chat_segments\` (
        \`id\` CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
        \`session_id\` VARCHAR(100) NOT NULL,
        \`day\` VARCHAR(10) NOT NULL,
        \`name\` VARCHAR(200) NOT NULL,
        \`description\` TEXT NULL,
        \`message_ids\` JSON NOT NULL,
        \`created_user\` CHAR(36),
        \`update_user\` CHAR(36),
        \`channel_id\` VARCHAR(100),
        \`is_delete\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
        INDEX \`idx_chat_seg_session_id\` (\`session_id\`),
        INDEX \`idx_chat_seg_session_day\` (\`session_id\`, \`day\`),
        CONSTRAINT \`fk_chat_seg_session\` FOREIGN KEY (\`session_id\`) REFERENCES \`chat_sessions\`(\`session_id\`) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `chat_segments`');
  }
}
