import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：重新设计待办事项表
 * @description 删除 pluginId/action/receipt 字段，新增 content/followerIds/statusColor，创建 todo_followups 和 todo_followup_comments 表
 * @keywords-cn 迁移, 待办事项, 跟进记录, 评论
 * @keywords-en migration, todos, followups, comments
 */
export class RedesignTodos1773980000000 implements MigrationInterface {
  name = 'RedesignTodos1773980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 删除 todos 表的旧字段
    await queryRunner.query(`
      ALTER TABLE todos
        DROP COLUMN IF EXISTS plugin_id,
        DROP COLUMN IF EXISTS action,
        DROP COLUMN IF EXISTS receipt,
        DROP COLUMN IF EXISTS recipient_id
    `);

    // 2. 新增字段
    await queryRunner.query(`
      ALTER TABLE todos
        ADD COLUMN IF NOT EXISTS content TEXT,
        ADD COLUMN IF NOT EXISTS followerIds JSONB,
        ADD COLUMN IF NOT EXISTS statusColor VARCHAR(16)
    `);

    // 3. 创建 todo_followups 表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS todo_followups (
        id VARCHAR(36) PRIMARY KEY,
        todoId VARCHAR(36) NOT NULL,
        followerId VARCHAR(36) NOT NULL,
        followerName VARCHAR(128),
        followerAvatar VARCHAR(512),
        status VARCHAR(32) NOT NULL,
        content TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_todo_followups_todo (todoId)
      )
    `);

    // 4. 创建 todo_followup_comments 表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS todo_followup_comments (
        id VARCHAR(36) PRIMARY KEY,
        followupId VARCHAR(36) NOT NULL,
        userId VARCHAR(36) NOT NULL,
        userName VARCHAR(128),
        userAvatar VARCHAR(512),
        content TEXT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_todo_followup_comments_followup (followupId)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. 删除 todo_followup_comments 表
    await queryRunner.query(`
      DROP TABLE IF EXISTS todo_followup_comments
    `);

    // 2. 删除 todo_followups 表
    await queryRunner.query(`
      DROP TABLE IF EXISTS todo_followups
    `);

    // 3. 删除 todos 表的新字段
    await queryRunner.query(`
      ALTER TABLE todos
        DROP COLUMN IF EXISTS content,
        DROP COLUMN IF EXISTS followerIds,
        DROP COLUMN IF EXISTS statusColor
    `);

    // 4. 恢复 todos 表的旧字段（如果需要回滚）
    await queryRunner.query(`
      ALTER TABLE todos
        ADD COLUMN IF NOT EXISTS plugin_id VARCHAR(36),
        ADD COLUMN IF NOT EXISTS action JSON,
        ADD COLUMN IF NOT EXISTS receipt JSON,
        ADD COLUMN IF NOT EXISTS recipient_id VARCHAR(36)
    `);
  }
}
