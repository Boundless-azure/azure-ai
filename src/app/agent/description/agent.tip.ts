/**
 * @title Agent 模块描述
 * @description 提供 Agent 与执行Agent 的持久化与接口（仅查改删）。
 * @keywords-cn 模块描述, Agent, 执行Agent, 查改删
 * @keywords-en module-description, agent, agent-execution, crud-ro
 */
export const AGENT_MODULE_DESCRIPTION = {
  files: {
    controllers: [
      'controllers/agent.controller.ts',
      'controllers/execution.controller.ts',
    ],
    services: ['services/agent.service.ts', 'services/execution.service.ts'],
    entities: [
      'entities/agent.entity.ts',
      'entities/agent-execution.entity.ts',
    ],
    types: ['types/agent.types.ts'],
    enums: ['enums/agent.enums.ts'],
    cache: ['cache/agent.cache.ts'],
  },
  desc: '管理 Agent 元信息与执行记录，提供只读与受限更新接口，不支持新增。',
};
