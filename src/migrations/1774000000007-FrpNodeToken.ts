import { MigrationInterface, QueryRunner } from 'typeorm';

export class FrpNodeToken1774000000007 implements MigrationInterface {
  name = 'FrpNodeToken1774000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "frp_nodes"
      ADD COLUMN IF NOT EXISTS "token" varchar(128) NOT NULL DEFAULT ''
    `);

    // 为 default 节点设置默认 token（实际生产请更换）
    await queryRunner.query(`
      UPDATE "frp_nodes"
      SET "token" = 'frps-default-token-change-in-production'
      WHERE "id" = 'default' AND "token" = ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "frp_nodes" DROP COLUMN IF EXISTS "token"`,
    );
  }
}
