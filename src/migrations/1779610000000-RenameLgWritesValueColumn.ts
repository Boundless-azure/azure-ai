import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：lg_writes.value_b64 → value_json
 * @description checkpoint pending write 的存储值已从 base64(JSON) 改为直接存原始 JSON 文本
 *              (去掉多此一举的 base64 编码), 列名同步改为 value_json 以名副其实。
 *              解码侧向后兼容旧 base64 值, 故存量行无需数据回填。
 * @keywords-cn 迁移, LangGraph, 写入, 列改名, base64去除
 * @keywords-en migration, langgraph, writes, column-rename, drop-base64
 */
export class RenameLgWritesValueColumn1779610000000
  implements MigrationInterface
{
  name = 'RenameLgWritesValueColumn1779610000000';

  /**
   * @title 执行迁移
   * @description 将 lg_writes.value_b64 重命名为 value_json (类型 TEXT NOT NULL 不变)。
   * @keyword-en rename-value-column-up
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lg_writes" RENAME COLUMN "value_b64" TO "value_json"`,
    );
  }

  /**
   * @title 回滚迁移
   * @description 将 value_json 改回 value_b64。
   * @keyword-en rename-value-column-down
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lg_writes" RENAME COLUMN "value_json" TO "value_b64"`,
    );
  }
}
