import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：IM 通讯录分组
 * @description 创建通讯录分组表（im_contact_groups）与分组成员表（im_contact_group_members）。
 * @keywords-cn 迁移, 通讯录分组, 分组表, 成员表, IM
 * @keywords-en migration, contact-groups, group-table, member-table, im
 */
export class ImContactGroups1769950000000 implements MigrationInterface {
  name = 'ImContactGroups1769950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS im_contact_groups (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        owner_principal_id CHAR(36) NOT NULL,
        name VARCHAR(100) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_im_contact_groups_owner ON im_contact_groups(owner_principal_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_im_contact_groups_owner_name ON im_contact_groups(owner_principal_id, name)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_im_contact_groups_is_delete ON im_contact_groups(is_delete)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS im_contact_group_members (
        id CHAR(36) PRIMARY KEY DEFAULT uuid_generate_v7()::text,
        group_id CHAR(36) NOT NULL,
        owner_principal_id CHAR(36) NOT NULL,
        member_principal_id CHAR(36) NOT NULL,
        created_user CHAR(36),
        update_user CHAR(36),
        channel_id VARCHAR(100),
        is_delete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_im_contact_group_members_group ON im_contact_group_members(group_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_im_contact_group_members_owner ON im_contact_group_members(owner_principal_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_im_contact_group_members_member ON im_contact_group_members(member_principal_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_im_contact_group_members_group_member ON im_contact_group_members(group_id, member_principal_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_im_contact_group_members_is_delete ON im_contact_group_members(is_delete)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS im_contact_group_members`);
    await queryRunner.query(`DROP TABLE IF EXISTS im_contact_groups`);
  }
}
