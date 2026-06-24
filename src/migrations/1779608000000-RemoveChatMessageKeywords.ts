import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * @title 迁移：移除逐消息关键词列
 * @description 删除 chat_session_messages.keywords，逐条消息不再做 LLM 关键词筛分；历史检索统一保留 chat_session_smart 分段标签。
 * @keyword-cn 迁移, 消息关键词, Smart索引
 * @keyword-en migration, message-keywords, smart-index
 */
export class RemoveChatMessageKeywords1779608000000 implements MigrationInterface {
  name = 'RemoveChatMessageKeywords1779608000000';

  /**
   * 删除逐消息关键词列。
   * @keyword-en remove-message-keywords-up, smart-index
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasKeywords = await queryRunner.hasColumn(
      'chat_session_messages',
      'keywords',
    );
    if (hasKeywords) {
      await queryRunner.dropColumn('chat_session_messages', 'keywords');
    }
  }

  /**
   * 回滚时恢复 nullable JSON keywords 列。
   * @keyword-en remove-message-keywords-down, rollback
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasKeywords = await queryRunner.hasColumn(
      'chat_session_messages',
      'keywords',
    );
    if (!hasKeywords) {
      await queryRunner.addColumn(
        'chat_session_messages',
        new TableColumn({
          name: 'keywords',
          type: 'json',
          isNullable: true,
        }),
      );
    }
  }
}
