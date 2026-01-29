import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 修改 Agents 表：embedding 改为 vector，新增 keywords
 * @desc 为向量检索统一列名为 embedding（pgvector），并增加 keywords JSONB 作为回退匹配。
 * @keywords-cn 迁移, 向量列, 关键词数组, pgvector
 * @keywords-en migration, vector-column, keywords-array, pgvector
 */
export class AlterAgentsEmbeddingAndKeywords1767196200001 implements MigrationInterface {
  name = 'AlterAgentsEmbeddingAndKeywords1767196200001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    // 将 embedding 从 JSONB 列改为 pgvector（若已存在且类型不兼容则删除重建）
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'agents' AND column_name = 'embedding' AND data_type = 'jsonb'
        ) THEN
          ALTER TABLE agents DROP COLUMN embedding;
          ALTER TABLE agents ADD COLUMN embedding vector(1536);
        ELSIF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'agents' AND column_name = 'embedding'
        ) THEN
          ALTER TABLE agents ADD COLUMN embedding vector(1536);
        END IF;
      END
      $$;
    `);

    // 新增 keywords JSONB 列（字符串数组）
    await queryRunner.query(
      `ALTER TABLE agents ADD COLUMN IF NOT EXISTS keywords JSONB`,
    );

    // 为 embedding 建立 ivfflat 索引（cosine 距离）
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_agents_embedding ON agents USING ivfflat (embedding vector_cosine_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_agents_embedding`);
    await queryRunner.query(
      `ALTER TABLE agents DROP COLUMN IF EXISTS keywords`,
    );
    // 回滚到 JSONB 类型（与初始建表一致）
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'agents' AND column_name = 'embedding' AND udt_name = 'vector'
        ) THEN
          ALTER TABLE agents DROP COLUMN embedding;
          ALTER TABLE agents ADD COLUMN embedding JSONB;
        END IF;
      END
      $$;
    `);
  }
}
