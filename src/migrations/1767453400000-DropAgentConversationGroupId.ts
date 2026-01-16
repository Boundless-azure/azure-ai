import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropAgentConversationGroupId1767453400000 implements MigrationInterface {
  name = 'DropAgentConversationGroupId1767453400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const type = (queryRunner.connection.options as { type?: string }).type;
    const isPg = type === 'postgres';
    if (isPg) {
      await queryRunner.query('DROP INDEX IF EXISTS idx_agents_conv_group');
      await queryRunner.query(
        'ALTER TABLE agents DROP COLUMN IF EXISTS conversation_group_id',
      );
    } else {
      try {
        await queryRunner.query(
          'ALTER TABLE agents DROP COLUMN conversation_group_id',
        );
      } catch (_e) {
        void 0;
      }
      try {
        await queryRunner.query('DROP INDEX idx_agents_conv_group ON agents');
      } catch (_e) {
        void 0;
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const type = (queryRunner.connection.options as { type?: string }).type;
    const isPg = type === 'postgres';
    if (isPg) {
      await queryRunner.query(
        'ALTER TABLE agents ADD COLUMN IF NOT EXISTS conversation_group_id CHAR(36) NULL',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_agents_conv_group ON agents (conversation_group_id)',
      );
    } else {
      try {
        await queryRunner.query(
          'ALTER TABLE agents ADD COLUMN conversation_group_id CHAR(36) NULL',
        );
      } catch (_e) {
        void 0;
      }
      try {
        await queryRunner.query(
          'CREATE INDEX idx_agents_conv_group ON agents (conversation_group_id)',
        );
      } catch (_e) {
        void 0;
      }
    }
  }
}
