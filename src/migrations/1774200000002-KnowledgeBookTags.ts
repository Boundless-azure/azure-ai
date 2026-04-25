import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：知识书本标签字段
 * @description 为 knowledge_books 表添加 tags 列（简单逗号分隔字符串）
 * @keywords-cn 迁移, 知识, 标签
 * @keywords-en migration, knowledge, tags
 */
export class KnowledgeBookTags1774200000002 implements MigrationInterface {
    name = 'KnowledgeBookTags1774200000002';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      ALTER TABLE knowledge_books ADD COLUMN IF NOT EXISTS tags TEXT
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      ALTER TABLE knowledge_books DROP COLUMN IF EXISTS tags
    `);
    }
}
