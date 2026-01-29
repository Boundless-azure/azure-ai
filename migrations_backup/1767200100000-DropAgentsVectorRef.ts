import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropAgentsVectorRef1767200100000 implements MigrationInterface {
  name = 'DropAgentsVectorRef1767200100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE agents DROP COLUMN IF EXISTS vector_ref`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE agents ADD COLUMN IF NOT EXISTS vector_ref VARCHAR(200)`,
    );
  }
}
