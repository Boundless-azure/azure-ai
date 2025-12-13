import { MigrationInterface, QueryRunner } from 'typeorm';

export class SplitChatMessages1761561000000 implements MigrationInterface {
  name = 'SplitChatMessages1761561000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 创建消息记录表（每条消息一行）
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_session_messages (
        id CHAR(36) PRIMARY KEY,
        session_id VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        keywords JSONB NULL,
        metadata JSONB NULL,
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ,
        CONSTRAINT fk_chat_msg_session FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_chat_msg_session_id ON chat_session_messages (session_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_chat_msg_session_role ON chat_session_messages (session_id, role)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_chat_msg_session_created ON chat_session_messages (session_id, created_at)',
    );

    // 建立全文索引（兼容 MySQL）
    try {
      await queryRunner.query(
        "CREATE INDEX IF NOT EXISTS idx_chat_session_messages_ft ON chat_session_messages USING GIN (to_tsvector('simple', coalesce(content, '')))",
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
      'SELECT session_id, user_id, messages FROM chat_sessions WHERE is_delete = FALSE',
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
             VALUES (gen_random_uuid()::text, $1, $2, $3, NULL, $4, $5, $6, NULL, FALSE, $7, $8)`,
            [session_id, role, content, metadataStr, user_id, user_id, ts, ts],
          );
        } else {
          await queryRunner.query(
            `INSERT INTO chat_session_messages (id, session_id, role, content, keywords, metadata, created_user, update_user, channel_id, is_delete)
             VALUES (gen_random_uuid()::text, $1, $2, $3, NULL, $4, $5, $6, NULL, FALSE)`,
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
      "ALTER TABLE chat_sessions ADD COLUMN messages JSONB NOT NULL DEFAULT '[]'::jsonb",
    );

    // 按会话聚合消息回填到 chat_sessions.messages
    const sessions: Array<{ session_id: string }> = await queryRunner.query(
      'SELECT session_id FROM chat_sessions WHERE is_delete = FALSE',
    );
    for (const s of sessions) {
      const rows: Array<{
        role: string;
        content: string;
        metadata: unknown;
        created_at: Date;
      }> = await queryRunner.query(
        'SELECT role, content, metadata, created_at FROM chat_session_messages WHERE session_id = $1 AND is_delete = FALSE ORDER BY created_at ASC',
        [s.session_id],
      );
      const arr = rows.map((r) => {
        let meta: unknown = undefined;
        if (r.metadata) {
          if (typeof r.metadata === 'string') {
            try {
              meta = JSON.parse(r.metadata) as unknown;
            } catch {
              meta = undefined;
            }
          } else {
            meta = r.metadata;
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
        'UPDATE chat_sessions SET messages = $1 WHERE session_id = $2',
        [JSON.stringify(arr), s.session_id],
      );
    }

    // 删除消息记录表与全文索引
    try {
      await queryRunner.query(
        'DROP INDEX IF EXISTS idx_chat_session_messages_ft',
      );
    } catch {
      // 忽略索引删除错误
    }
    await queryRunner.query('DROP TABLE IF EXISTS chat_session_messages');
  }
}
