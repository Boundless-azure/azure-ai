import { MigrationInterface, QueryRunner } from 'typeorm';

export class SplitChatMessages1761561000000 implements MigrationInterface {
  name = 'SplitChatMessages1761561000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 创建消息记录表（每条消息一行）
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`chat_session_messages\` (
        \`id\` CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
        \`session_id\` VARCHAR(100) NOT NULL,
        \`role\` ENUM('system','user','assistant') NOT NULL,
        \`content\` TEXT NOT NULL,
        \`keywords\` JSON NULL,
        \`metadata\` JSON NULL,
        \`created_user\` CHAR(36),
        \`update_user\` CHAR(36),
        \`channel_id\` VARCHAR(100),
        \`is_delete\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
        INDEX \`idx_chat_msg_session_id\` (\`session_id\`),
        INDEX \`idx_chat_msg_session_role\` (\`session_id\`, \`role\`),
        INDEX \`idx_chat_msg_session_created\` (\`session_id\`, \`created_at\`),
        CONSTRAINT \`fk_chat_msg_session\` FOREIGN KEY (\`session_id\`) REFERENCES \`chat_sessions\`(\`session_id\`) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    // 建立全文索引（兼容 MySQL）
    try {
      await queryRunner.query(
        'CREATE FULLTEXT INDEX IDX_CHAT_SESSION_MESSAGES_FT ON chat_session_messages (content)',
      );
    } catch {
      // 某些引擎或旧版本不支持，忽略
    }

    // 将现有 chat_sessions.messages JSON 迁移到新表
    const sessions: Array<{
      session_id: string;
      user_id: string | null;
      messages: string | null;
    }> = await queryRunner.query(
      'SELECT session_id, user_id, messages FROM chat_sessions WHERE is_delete = 0',
    );
    for (const row of sessions) {
      const { session_id, user_id, messages } = row;
      if (!messages) continue;
      let arr: unknown[] = [];
      try {
        const parsed = JSON.parse(messages) as unknown;
        arr = Array.isArray(parsed) ? parsed : [];
      } catch {
        arr = [];
      }
      for (const m of arr) {
        if (!m || typeof m !== 'object') continue;
        const rec = m as Record<string, unknown>;
        const rawRole = rec['role'];
        const role: 'system' | 'user' | 'assistant' =
          rawRole === 'system' || rawRole === 'assistant' || rawRole === 'user'
            ? rawRole
            : 'user';
        const contentRaw = rec['content'];
        const content =
          typeof contentRaw === 'string'
            ? contentRaw
            : typeof contentRaw === 'number' || typeof contentRaw === 'boolean'
              ? String(contentRaw)
              : contentRaw && typeof contentRaw === 'object'
                ? JSON.stringify(contentRaw)
                : '';
        const metadataRaw = rec['metadata'];
        const metadataStr =
          metadataRaw && typeof metadataRaw === 'object'
            ? JSON.stringify(metadataRaw)
            : null;
        const tsRaw = rec['timestamp'];
        let ts: Date | null = null;
        if (tsRaw instanceof Date) {
          ts = tsRaw;
        } else if (typeof tsRaw === 'string' || typeof tsRaw === 'number') {
          const d = new Date(tsRaw);
          if (!Number.isNaN(d.getTime())) ts = d;
        }
        // 插入消息行，若有原始时间戳，则使用它作为 created_at
        if (ts) {
          await queryRunner.query(
            `INSERT INTO chat_session_messages (id, session_id, role, content, keywords, metadata, created_user, update_user, channel_id, is_delete, created_at, updated_at)
             VALUES (UUID(), ?, ?, ?, NULL, ?, ?, ?, NULL, 0, ?, ?)`,
            [session_id, role, content, metadataStr, user_id, user_id, ts, ts],
          );
        } else {
          await queryRunner.query(
            `INSERT INTO chat_session_messages (id, session_id, role, content, keywords, metadata, created_user, update_user, channel_id, is_delete)
             VALUES (UUID(), ?, ?, ?, NULL, ?, ?, ?, NULL, 0)`,
            [session_id, role, content, metadataStr, user_id, user_id],
          );
        }
      }
    }

    // 从 chat_sessions 中移除 messages 字段
    await queryRunner.query('ALTER TABLE chat_sessions DROP COLUMN messages');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 回滚：为 chat_sessions 恢复 messages JSON 列
    await queryRunner.query(
      'ALTER TABLE chat_sessions ADD COLUMN messages JSON NOT NULL DEFAULT JSON_ARRAY()',
    );

    // 按会话聚合消息回填到 chat_sessions.messages
    const sessions: Array<{ session_id: string }> = await queryRunner.query(
      'SELECT session_id FROM chat_sessions WHERE is_delete = 0',
    );
    for (const s of sessions) {
      const rows: Array<{
        role: string;
        content: string;
        metadata: string | null;
        created_at: Date;
      }> = await queryRunner.query(
        'SELECT role, content, metadata, created_at FROM chat_session_messages WHERE session_id = ? AND is_delete = 0 ORDER BY created_at ASC',
        [s.session_id],
      );
      const arr = rows.map((r) => {
        let meta: unknown = undefined;
        if (r.metadata) {
          try {
            meta = JSON.parse(r.metadata) as unknown;
          } catch {
            meta = undefined;
          }
        }
        return {
          role: r.role,
          content: r.content,
          metadata: meta,
          timestamp: r.created_at,
        };
      });
      await queryRunner.query(
        'UPDATE chat_sessions SET messages = ? WHERE session_id = ?',
        [JSON.stringify(arr), s.session_id],
      );
    }

    // 删除消息记录表与全文索引
    try {
      await queryRunner.query(
        'DROP INDEX IDX_CHAT_SESSION_MESSAGES_FT ON chat_session_messages',
      );
    } catch {
      // 忽略索引删除错误
    }
    await queryRunner.query('DROP TABLE IF EXISTS `chat_session_messages`');
  }
}
