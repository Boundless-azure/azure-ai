import { MigrationInterface, QueryRunner } from 'typeorm';

export class FrpNodes1774000000005 implements MigrationInterface {
  name = 'FrpNodes1774000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "frp_nodes" (
        "id" char(36) NOT NULL,
        "node_ip" varchar(45) NOT NULL,
        "node_port" int NOT NULL DEFAULT 7000,
        "node_address" varchar(255) NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'active',
        CONSTRAINT "PK_frp_nodes" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_frp_nodes_status" ON "frp_nodes" ("status")
    `);

    // 插入默认节点
    await queryRunner.query(`
      INSERT INTO "frp_nodes" ("id", "node_ip", "node_port", "node_address", "status")
      VALUES ('default', '127.0.0.1', 7000, '本地', 'active')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "frp_nodes"`);
  }
}
