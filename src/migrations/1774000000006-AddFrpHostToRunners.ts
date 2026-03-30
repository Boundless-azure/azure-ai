import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFrpHostToRunners1774000000006 implements MigrationInterface {
  name = 'AddFrpHostToRunners1774000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "runners" ADD COLUMN IF NOT EXISTS "frp_host" varchar(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "runners" DROP COLUMN IF EXISTS "frp_host"`,
    );
  }
}
