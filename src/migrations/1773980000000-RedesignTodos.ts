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
        ADD COLUMN IF NOT EXISTS initiator_id CHAR(36),
        ADD COLUMN IF NOT EXISTS content TEXT,
        ADD COLUMN IF NOT EXISTS followerids JSONB,
        ADD COLUMN IF NOT EXISTS statuscolor VARCHAR(16),
        ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true
    `);

    // 3. 创建 todo_followups 表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS todo_followups (
        id VARCHAR(36) PRIMARY KEY,
        todoid VARCHAR(36) NOT NULL,
        followerid VARCHAR(36) NOT NULL,
        followername VARCHAR(128),
        followeravatar VARCHAR(512),
        status VARCHAR(32) NOT NULL,
        content TEXT,
        created_user VARCHAR(36),
        update_user VARCHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      )
    `);

    // 4. 创建 todo_followups 索引
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_todo_followups_todo ON todo_followups (todoid)
    `);

    // 5. 创建 todo_followup_comments 表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS todo_followup_comments (
        id VARCHAR(36) PRIMARY KEY,
        followupid VARCHAR(36) NOT NULL,
        userid VARCHAR(36) NOT NULL,
        username VARCHAR(128),
        useravatar VARCHAR(512),
        content TEXT NOT NULL,
        created_user VARCHAR(36),
        update_user VARCHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      )
    `);

    // 6. 创建 todo_followup_comments 索引
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_todo_followup_comments_followup ON todo_followup_comments (followupid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. 删除 todo_followup_comments 索引
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_todo_followup_comments_followup
    `);

    // 2. 删除 todo_followup_comments 表
    await queryRunner.query(`
      DROP TABLE IF EXISTS todo_followup_comments
    `);

    // 3. 删除 todo_followups 索引
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_todo_followups_todo
    `);

    // 4. 删除 todo_followups 表
    await queryRunner.query(`
      DROP TABLE IF EXISTS todo_followups
    `);

    // 5. 删除 todos 表的新字段
    await queryRunner.query(`
      ALTER TABLE todos
        DROP COLUMN IF EXISTS initiator_id,
        DROP COLUMN IF EXISTS content,
        DROP COLUMN IF EXISTS followerids,
        DROP COLUMN IF EXISTS statuscolor,
        DROP COLUMN IF EXISTS active
    `);

    // 6. 恢复 todos 表的旧字段（如果需要回滚）
    await queryRunner.query(`
      ALTER TABLE todos
        ADD COLUMN IF NOT EXISTS plugin_id VARCHAR(36),
        ADD COLUMN IF NOT EXISTS action JSON,
        ADD COLUMN IF NOT EXISTS receipt JSON,
        ADD COLUMN IF NOT EXISTS recipient_id VARCHAR(36)
    `);
  }
}
