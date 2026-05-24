import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：新增 Notification 消息类型
 * @description 为 chat_session_messages.message_type (PG ENUM `chat_message_type`) 添加 notification 值。
 *              notification 类型消息 AI 可见, 用户端隐藏, 用于 Runner 回调等场景。
 *
 *              注意: 列实际是 PG ENUM 类型 (见 1737200000002-ChatIM 创建语句), 不是 CHECK 约束;
 *              所以这里走 `ALTER TYPE ... ADD VALUE`, 不能用 `DROP CHECK / ADD CONSTRAINT` 的路子。
 *              `ADD VALUE IF NOT EXISTS` 让重跑安全, 不需要事务支持 (PG 12+ ALTER TYPE 已可在事务里执行)。
 *
 *              down 路径要把枚举值删掉, 但 PG 不支持 `DROP VALUE`, 必须重建枚举类型 ::
 *              新建临时类型 -> 列改用临时类型 (强转) -> 删旧类型 -> 临时改名为旧名。
 *              已有的 notification 行会在转换中报错, down 前必须先确保没有 notification 数据。
 * @keywords-cn 迁移, 消息类型, notification, PG枚举, ALTER TYPE
 * @keywords-en migration, message-type, notification, pg-enum, alter-type-add-value
 */
export class AddNotificationMessageType1774400000000 implements MigrationInterface {
  name = 'AddNotificationMessageType1774400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 给 PG ENUM 添加新值 :: IF NOT EXISTS 让重跑幂等
    await queryRunner.query(
      `ALTER TYPE chat_message_type ADD VALUE IF NOT EXISTS 'notification'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PG 不支持直接 DROP 枚举值, 走"重建枚举 + 强转列"路径
    // 调用方要确保此时没有 message_type='notification' 的行 (USING 强转会失败)
    await queryRunner.query(
      `CREATE TYPE chat_message_type_old AS ENUM ('text', 'image', 'file', 'system')`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_session_messages
         ALTER COLUMN message_type DROP DEFAULT,
         ALTER COLUMN message_type TYPE chat_message_type_old
           USING message_type::text::chat_message_type_old,
         ALTER COLUMN message_type SET DEFAULT 'text'`,
    );
    await queryRunner.query(`DROP TYPE chat_message_type`);
    await queryRunner.query(
      `ALTER TYPE chat_message_type_old RENAME TO chat_message_type`,
    );
  }
}
