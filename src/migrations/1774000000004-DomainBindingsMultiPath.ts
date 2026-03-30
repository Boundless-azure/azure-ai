import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：domain_bindings 支持同域名多路径
 * @description 将 domain 单列唯一约束改为 (domain, path_pattern) 联合唯一约束，
 *              允许同一域名绑定多条不同 pathPattern 的路由规则。
 * @keywords-cn 迁移, domain_bindings, 多路径, 联合唯一
 * @keywords-en migration, domain_bindings, multi-path, composite-unique
 */
export class DomainBindingsMultiPath1774000000004 implements MigrationInterface {
  name = 'DomainBindingsMultiPath1774000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 删除旧的 domain 单列唯一约束
    await queryRunner.query(`
      ALTER TABLE "domain_bindings" DROP CONSTRAINT IF EXISTS "UQ_domain_bindings_domain"
    `);
    // 兼容 typeorm 生成的约束名
    await queryRunner.query(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN
          SELECT constraint_name FROM information_schema.table_constraints
          WHERE table_name = 'domain_bindings'
            AND constraint_type = 'UNIQUE'
            AND constraint_name NOT LIKE '%domain%path%'
            AND constraint_name NOT LIKE '%runner%'
        LOOP
          EXECUTE 'ALTER TABLE domain_bindings DROP CONSTRAINT IF EXISTS "' || r.constraint_name || '"';
        END LOOP;
      END $$;
    `);

    // 新增 (domain, path_pattern) 联合唯一约束
    await queryRunner.query(`
      ALTER TABLE "domain_bindings"
      ADD CONSTRAINT "UQ_domain_bindings_domain_path_pattern"
      UNIQUE ("domain", "path_pattern")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "domain_bindings"
      DROP CONSTRAINT IF EXISTS "UQ_domain_bindings_domain_path_pattern"
    `);
    await queryRunner.query(`
      ALTER TABLE "domain_bindings"
      ADD CONSTRAINT "UQ_domain_bindings_domain" UNIQUE ("domain")
    `);
  }
}
