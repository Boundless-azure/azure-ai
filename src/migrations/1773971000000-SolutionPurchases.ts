import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：Solution 购买记录表
 * @description 创建 solution_purchases 表用于记录市场购买历史
 * @keywords-cn 迁移, solution_purchases, 购买记录, 市场购买
 * @keywords-en migration, solution_purchases, purchase-history, marketplace
 */
export class SolutionPurchases1773971000000 implements MigrationInterface {
  name = 'SolutionPurchases1773971000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS solution_purchases (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        user_id CHAR(36) NOT NULL,
        solution_id CHAR(36) NOT NULL,
        solution_name VARCHAR(255) NOT NULL,
        solution_version VARCHAR(64) NOT NULL,
        runner_id CHAR(36),
        source VARCHAR(32) NOT NULL DEFAULT 'marketplace',
        purchased_at TIMESTAMPTZ NOT NULL,
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ,
        CONSTRAINT fk_solution_purchases_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_solution_purchases_user_id ON solution_purchases(user_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_solution_purchases_solution_id ON solution_purchases(solution_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS solution_purchases`);
  }
}
