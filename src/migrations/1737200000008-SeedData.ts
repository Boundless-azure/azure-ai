import { MigrationInterface, QueryRunner } from 'typeorm';
import { randomBytes, scryptSync } from 'crypto';
import { v7 as uuidv7 } from 'uuid';

/**
 * @title 迁移：种子数据
 * @description 初始化系统必要数据：组织、角色、权限、管理员、AI模型、模板、Agent
 * @keywords-cn 迁移, 种子数据, 初始化
 * @keywords-en migration, seed-data, init
 */
export class SeedData1737200000008 implements MigrationInterface {
  name = 'SeedData1737200000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== 1. 组织 ==========
    const orgId = '1';
    await queryRunner.query(
      `INSERT INTO organizations (id, name, code, active) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [orgId, 'Default Org', 'default', true],
    );

    // ========== 2. 角色 ==========
    const adminRoleId = '1';
    const guestRoleId = '2';

    await queryRunner.query(
      `INSERT INTO roles (id, name, code, description, organization_id, builtin) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
      [
        adminRoleId,
        'Administrator',
        'admin',
        'System administrator role',
        orgId,
        true,
      ],
    );

    await queryRunner.query(
      `INSERT INTO roles (id, name, code, description, organization_id, builtin) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
      [
        guestRoleId,
        'Guest',
        'guest',
        'Guest role with limited access',
        orgId,
        true,
      ],
    );

    // ========== 3. 角色权限 ==========
    await queryRunner.query(
      `INSERT INTO role_permissions (id, role_id, subject, action, conditions) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
      [uuidv7(), adminRoleId, '*', 'manage', null],
    );

    // ========== 4. 权限定义 ==========
    const permDefs: Array<[string, string]> = [
      ['principal', 'read'],
      ['principal', 'create'],
      ['principal', 'update'],
      ['principal', 'delete'],
      ['organization', 'read'],
      ['organization', 'create'],
      ['organization', 'update'],
      ['organization', 'delete'],
      ['role', 'read'],
      ['role', 'create'],
      ['role', 'update'],
      ['role', 'delete'],
      ['role_permission', 'read'],
      ['role_permission', 'update'],
      ['membership', 'read'],
      ['membership', 'create'],
      ['membership', 'delete'],
      ['permission_definition', 'read'],
      ['permission_definition', 'create'],
      ['permission_definition', 'delete'],
    ];

    for (const [subject, action] of permDefs) {
      await queryRunner.query(
        `INSERT INTO permission_definitions (id, subject, action) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [uuidv7(), subject, action],
      );
    }

    // ========== 5. 管理员账号 ==========
    const adminPrincipalId = '1';
    const adminUserId = '1';
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync('admin123', salt, 32).toString('hex');

    await queryRunner.query(
      `INSERT INTO principals (id, display_name, principal_type, email, tenant_id, active) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
      [
        adminPrincipalId,
        'Administrator',
        'system',
        'admin@example.com',
        orgId,
        true,
      ],
    );

    await queryRunner.query(
      `INSERT INTO users (id, principal_id, email, password_hash, password_salt) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
      [adminUserId, adminPrincipalId, 'admin@example.com', hash, salt],
    );

    // 管理员成员关系
    await queryRunner.query(
      `INSERT INTO memberships (id, organization_id, principal_id, role_id, active) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
      [uuidv7(), orgId, adminPrincipalId, adminRoleId, true],
    );

    // ========== 6. AI 模型 ==========
    await queryRunner.query(
      `INSERT INTO ai_models (id, name, "displayName", provider, type, status, "apiKey", description, enabled) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING`,
      [
        '1',
        'gemini-1.5-pro',
        'Gemini 1.5 Pro',
        'gemini',
        'chat',
        'active',
        'CHANGE_ME',
        'Google Gemini 1.5 Pro 模型',
        true,
      ],
    );

    await queryRunner.query(
      `INSERT INTO ai_models (id, name, "displayName", provider, type, status, "apiKey", description, enabled) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING`,
      [
        '2',
        'deepseek-chat',
        'DeepSeek Chat',
        'deepseek',
        'chat',
        'active',
        'CHANGE_ME',
        'DeepSeek Chat 模型',
        true,
      ],
    );

    // ========== 7. 提示词模板 ==========
    await queryRunner.query(
      `INSERT INTO prompt_templates (id, name, template, variables, category, description, enabled) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7) ON CONFLICT DO NOTHING`,
      [
        '1',
        'default_assistant',
        'You are a helpful AI assistant.',
        '[]',
        'system',
        '默认助手提示词',
        true,
      ],
    );

    await queryRunner.query(
      `INSERT INTO prompt_templates (id, name, template, variables, category, description, enabled) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7) ON CONFLICT DO NOTHING`,
      [
        '2',
        'code_helper',
        'You are an experienced programming assistant. Help users write clean, efficient code.',
        '[]',
        'system',
        '编程助手提示词',
        true,
      ],
    );

    await queryRunner.query(
      `INSERT INTO prompt_templates (id, name, template, variables, category, description, enabled) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7) ON CONFLICT DO NOTHING`,
      [
        '3',
        'translator',
        'You are a professional translator. Translate text accurately while maintaining context and tone.',
        '[]',
        'system',
        '翻译助手提示词',
        true,
      ],
    );

    // ========== 8. 默认 Agent ==========
    const codeAgentId = '1';
    const workflowAgentId = '2';

    // 代码智能体
    const codeAgentPrincipalId = uuidv7();
    await queryRunner.query(
      `INSERT INTO principals (id, display_name, principal_type, active) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [codeAgentPrincipalId, '代码智能体', 'agent', true],
    );

    await queryRunner.query(
      `INSERT INTO agents (id, code_dir, nickname, is_ai_generated, purpose, keywords, principal_id, active) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8) ON CONFLICT DO NOTHING`,
      [
        codeAgentId,
        'src/agents/code-agent',
        '代码智能体',
        false,
        '根据用户问题生成代码，使用工具执行，支持对话与动态调度。',
        JSON.stringify(['代码', '智能体', 'code-agent', '工具调用', '编排']),
        codeAgentPrincipalId,
        true,
      ],
    );

    // 工作流智能体
    const workflowAgentPrincipalId = uuidv7();
    await queryRunner.query(
      `INSERT INTO principals (id, display_name, principal_type, active) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [workflowAgentPrincipalId, '工作流智能体', 'agent', true],
    );

    await queryRunner.query(
      `INSERT INTO agents (id, code_dir, nickname, is_ai_generated, purpose, keywords, principal_id, active) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8) ON CONFLICT DO NOTHING`,
      [
        workflowAgentId,
        'src/agents/workflow-agent',
        '工作流智能体',
        false,
        '用于编排工作流与任务，协助多步骤流程执行。',
        JSON.stringify(['工作流', '智能体', 'workflow', '编排', '任务']),
        workflowAgentPrincipalId,
        true,
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 删除 Agent 及其 principal
    await queryRunner.query(
      `DELETE FROM agents WHERE code_dir IN ('src/agents/code-agent', 'src/agents/workflow-agent')`,
    );
    await queryRunner.query(
      `DELETE FROM principals WHERE display_name IN ('代码智能体', '工作流智能体')`,
    );

    // 删除提示词模板
    await queryRunner.query(
      `DELETE FROM prompt_templates WHERE id IN ('1', '2', '3')`,
    );

    // 删除 AI 模型
    await queryRunner.query(`DELETE FROM ai_models WHERE id IN ('1', '2')`);

    // 删除成员关系
    await queryRunner.query(`DELETE FROM memberships WHERE principal_id = '1'`);

    // 删除用户
    await queryRunner.query(`DELETE FROM users WHERE id = '1'`);

    // 删除 principal
    await queryRunner.query(`DELETE FROM principals WHERE id = '1'`);

    // 删除权限定义
    await queryRunner.query(`DELETE FROM permission_definitions`);

    // 删除角色权限
    await queryRunner.query(
      `DELETE FROM role_permissions WHERE role_id IN ('1', '2')`,
    );

    // 删除角色
    await queryRunner.query(`DELETE FROM roles WHERE id IN ('1', '2')`);

    // 删除组织
    await queryRunner.query(`DELETE FROM organizations WHERE id = '1'`);
  }
}
