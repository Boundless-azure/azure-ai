import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @title 迁移：更新 code-agent 用途说明与模型顺序建议
 * @description 为 code-agent 的用途说明补充 3 个模型槽位的用途与配置建议。
 * @keywords-cn 迁移, code-agent, 用途说明, 模型顺序
 * @keywords-en migration, code-agent, purpose, model-order
 */
export class CodeAgentPurposeModelOrder1779602000000 implements MigrationInterface {
  name = 'CodeAgentPurposeModelOrder1779602000000';

  /**
   * 更新 code-agent 的用途说明。
   * @keyword-en code-agent-purpose-up
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    const nextPurpose = [
      '根据用户问题进行代码与架构对话，并通过 code_gen_orchestrate 工具发起异步代码生成工作流。',
      '模型列表按顺序推荐配置：',
      '1. 对话主用：用于需求澄清、方案讨论、代码问答。建议选择综合对话稳定、长上下文和工具调用表现较好的模型。',
      '2. 逻辑编程主用：用于需求分析、Hook 设计、服务端逻辑与编程推理。建议选择代码生成、结构化推理和复杂指令遵循能力较强的模型。',
      '3. 前端主用：用于页面、组件与交互代码生成。建议选择前端表达、界面细节生成和长代码补全能力较强的模型。',
      '若对应槽位未配置，运行时会回退到当前已配置的首个模型；若整个列表为空，则需要先为 Agent 配置模型列表。',
    ].join('\n');

    await queryRunner.query(
      `UPDATE agents
       SET purpose = $1
       WHERE code_dir = $2`,
      [nextPurpose, 'src/agents/code-agent'],
    );
  }

  /**
   * 回滚 code-agent 的用途说明。
   * @keyword-en code-agent-purpose-down
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    const prevPurpose =
      '根据用户问题生成代码，使用工具执行，支持对话与动态调度。';

    await queryRunner.query(
      `UPDATE agents
       SET purpose = $1
       WHERE code_dir = $2`,
      [prevPurpose, 'src/agents/code-agent'],
    );
  }
}
