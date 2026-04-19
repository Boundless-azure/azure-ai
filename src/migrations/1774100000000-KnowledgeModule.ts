import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：知识模块
 * @description 创建 knowledge_books（知识书本）和 knowledge_chapters（知识章节）表
 * @keywords-cn 迁移, 知识, 书本, 章节
 * @keywords-en migration, knowledge, book, chapter
 */
export class KnowledgeModule1774100000000 implements MigrationInterface {
  name = 'KnowledgeModule1774100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS knowledge_books (
        id CHAR(36) PRIMARY KEY,
        type VARCHAR(16) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        creator_id CHAR(36),
        embedding vector,
        is_embedded BOOLEAN DEFAULT false,
        active BOOLEAN DEFAULT true,
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_kb_type ON knowledge_books (type)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_kb_creator ON knowledge_books (creator_id)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS knowledge_chapters (
        id CHAR(36) PRIMARY KEY,
        book_id CHAR(36) NOT NULL,
        title VARCHAR(255) NOT NULL,
        sort_order INT DEFAULT 0,
        is_lm_required BOOLEAN DEFAULT false,
        content TEXT,
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_kc_book ON knowledge_chapters (book_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_kc_book_sort ON knowledge_chapters (book_id, sort_order)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS knowledge_chapters`);
    await queryRunner.query(`DROP TABLE IF EXISTS knowledge_books`);
  }
}
