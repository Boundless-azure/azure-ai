import { MigrationInterface, QueryRunner } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

/**
 * @title 添加游客角色（无默认权限）
 * @description 在 roles 表插入内置游客角色；不添加任何 role_permissions。
 * @keywords-cn 游客角色, 迁移, 无权限
 * @keywords-en guest-role, migration, no-permissions
 */
export class AddGuestRole1767800900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const type = (queryRunner.connection.options as { type?: string }).type;
    const isPg = type === 'postgres';

    const existsSql = isPg
      ? 'SELECT id FROM roles WHERE code = $1 AND is_delete = false LIMIT 1'
      : 'SELECT id FROM roles WHERE code = ? AND is_delete = 0 LIMIT 1';
    const exists = await queryRunner.query(existsSql, ['guest']);
    if (Array.isArray(exists) && exists.length > 0) return;

    const id = uuidv7();
    const nowFn = 'NOW()';

    if (isPg) {
      await queryRunner.query(
        `INSERT INTO roles 
        (id, name, code, description, organization_id, builtin, created_user, update_user, channel_id, is_delete, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NULL, TRUE, NULL, NULL, NULL, FALSE, ${nowFn}, ${nowFn})`,
        [id, '游客', 'guest', 'Guest role with no default permissions'],
      );
    } else {
      await queryRunner.query(
        `INSERT INTO roles 
        (id, name, code, description, organization_id, builtin, created_user, update_user, channel_id, is_delete, created_at, updated_at)
        VALUES (?, ?, ?, ?, NULL, 1, NULL, NULL, NULL, 0, ${nowFn}, ${nowFn})`,
        [id, '游客', 'guest', 'Guest role with no default permissions'],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const type = (queryRunner.connection.options as { type?: string }).type;
    const isPg = type === 'postgres';
    const delSql = isPg
      ? 'DELETE FROM roles WHERE code = $1 AND is_delete = false'
      : 'DELETE FROM roles WHERE code = ? AND is_delete = 0';
    await queryRunner.query(delSql, ['guest']);
  }
}
