import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 删除 Agents 表中的备用向量列 embedding_vec
 * @desc 清理历史备用列与索引，仅保留统一的 embedding(pgvector)。
 * @keywords-cn 迁移, 删除列, 删除索引, pgvector
 * @keywords-en migration, drop-column, drop-index, pgvector
 */
export class DropAgentEmbeddingVec1767197500000 implements MigrationInterface {
  name = 'DropAgentEmbeddingVec1767197500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_agents_embedding_vec`);
    await queryRunner.query(
      `ALTER TABLE agents DROP COLUMN IF EXISTS embedding_vec`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE agents ADD COLUMN IF NOT EXISTS embedding_vec vector(1536)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_agents_embedding_vec ON agents USING ivfflat (embedding_vec vector_cosine_ops)`,
    );
  }
}
