import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：奖励记录表
 * @description 新增 reward_records 表，用于记录各类奖励发放。
 * @keywords-cn 迁移, 奖励记录, reward_records
 * @keywords-en migration, reward-record, reward_records
 */
export class RewardRecords1774000000002 implements MigrationInterface {
  name = 'RewardRecords1774000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reward_records" (
        "id" char(36) NOT NULL DEFAULT uuid_generate_v7()::text,
        "created_user" char(36),
        "update_user" char(36),
        "channel_id" varchar(100),
        "is_delete" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamptz,
        "reward_type" varchar(64) NOT NULL,
        "related_id" char(36) NOT NULL,
        "description" varchar(500),
        CONSTRAINT "PK_reward_records" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_reward_records_type_related"
      ON "reward_records" ("reward_type", "related_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_reward_records_related_id"
      ON "reward_records" ("related_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reward_records"`);
  }
}
