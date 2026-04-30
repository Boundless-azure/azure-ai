import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：新增 Notification 消息类型
 * @description 为 chat_session_messages.message_type 枚举添加 notification 值。
 *              notification 类型消息 AI 可见, 用户端隐藏, 用于 Runner 回调等场景。
 * @keywords-cn 迁移, 消息类型, notification, 通知
 * @keywords-en migration, message-type, notification, runner-callback
 */
export class AddNotificationMessageType1774400000000 implements MigrationInterface {
  name = 'AddNotificationMessageType1774400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE chat_session_messages DROP CHECK chat_session_messages_message_type_check`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_session_messages ADD CONSTRAINT chat_session_messages_message_type_check CHECK (message_type IN ('text', 'image', 'file', 'system', 'notification'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE chat_session_messages DROP CHECK chat_session_messages_message_type_check`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_session_messages ADD CONSTRAINT chat_session_messages_message_type_check CHECK (message_type IN ('text', 'image', 'file', 'system'))`,
    );
  }
}
