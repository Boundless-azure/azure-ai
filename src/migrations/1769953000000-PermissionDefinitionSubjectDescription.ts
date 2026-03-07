import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：权限定义Subject描述
 * @description 为 permission_definitions 增加 subject_description 字段，用于 Subject 级别说明。
 * @keywords-cn 迁移, 权限定义, subject描述
 * @keywords-en migration, permission-definition, subject-description
 */
export class PermissionDefinitionSubjectDescription1769953000000 implements MigrationInterface {
  name = 'PermissionDefinitionSubjectDescription1769953000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS permission_definitions
      ADD COLUMN IF NOT EXISTS subject_description TEXT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS permission_definitions
      DROP COLUMN IF EXISTS subject_description
    `);
  }
}
