import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：任务模块权限定义
 * @description 为 task 模块补齐 management 类型权限定义，支持角色配置 UI 分配 read/create/update/delete。
 * @keywords-cn 迁移, 任务, 权限定义, 管理权限
 * @keywords-en migration, task, permission-definition, management-permission
 */
export class TaskPermissionDefinitions1779070900000
  implements MigrationInterface
{
  name = 'TaskPermissionDefinitions1779070900000';

  private readonly rootDescription = 'Task module management permission root';

  private readonly actionDescriptions: Record<string, string> = {
    read: 'Task module read permission',
    create: 'Task module create permission',
    update: 'Task module update permission',
    delete: 'Task module delete permission',
  };

  /**
   * @title 执行迁移
   * @description 新增 task subject root 与 CRUD management action 节点。
   * @keyword-en task-permission-definitions-up
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO permission_definitions (
          id,
          fid,
          node_key,
          permission_type,
          weight,
          description,
          is_delete
        )
        SELECT uuid_generate_v7()::text, NULL, 'task', 'management', 0, $1::text, FALSE
        WHERE NOT EXISTS (
          SELECT 1
          FROM permission_definitions
          WHERE fid IS NULL
            AND node_key = 'task'
            AND permission_type = 'management'
            AND is_delete = FALSE
        )
      `,
      [this.rootDescription],
    );

    const roots = await queryRunner.query(
      `
        SELECT id
        FROM permission_definitions
        WHERE fid IS NULL
          AND node_key = 'task'
          AND permission_type = 'management'
          AND is_delete = FALSE
        ORDER BY created_at ASC
        LIMIT 1
      `,
    );
    const rootId = roots[0]?.id as string | undefined;
    if (!rootId) return;

    for (const [action, description] of Object.entries(this.actionDescriptions)) {
      await queryRunner.query(
        `
          INSERT INTO permission_definitions (
            id,
            fid,
            node_key,
            permission_type,
            weight,
            description,
            is_delete
          )
            SELECT uuid_generate_v7()::text, $1::varchar(36), $2::varchar(64), 'management', 0, $3::text, FALSE
          WHERE NOT EXISTS (
            SELECT 1
            FROM permission_definitions
              WHERE fid = $1::varchar(36)
                AND node_key = $2::varchar(64)
              AND permission_type = 'management'
              AND is_delete = FALSE
          )
        `,
        [rootId, action, description],
      );
    }
  }

  /**
   * @title 回滚迁移
   * @description 删除本迁移插入的 task management 权限定义节点。
   * @keyword-en task-permission-definitions-down
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const description of Object.values(this.actionDescriptions)) {
      await queryRunner.query(
        `DELETE FROM permission_definitions WHERE description = $1`,
        [description],
      );
    }
    await queryRunner.query(
      `DELETE FROM permission_definitions WHERE description = $1`,
      [this.rootDescription],
    );
  }
}
