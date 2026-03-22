import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：修复用户和群聊的 Principal 类型
 * @description 将 'enterprise' 类型的用户和群聊改为 'user' 类型
 * @keywords-cn 迁移, 用户类型, 群聊类型
 * @keywords-en migration, user-type, group-type
 */
export class FixUserPrincipalType1773953000000 implements MigrationInterface {
  name = 'FixUserPrincipalType1773953000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fix principals with 'enterprise' type to 'user'
    await queryRunner.query(`
      UPDATE principals SET principal_type = 'user' WHERE principal_type = 'enterprise'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert back to 'enterprise'
    await queryRunner.query(`
      UPDATE principals SET principal_type = 'enterprise' WHERE principal_type = 'user'
    `);
  }
}
