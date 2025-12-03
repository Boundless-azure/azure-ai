/**
 * @title Agent Module Definition
 * @description Exports and configuration for the Agent module.
 * @keywords-cn 模块定义, 导出, 配置
 * @keywords-en module-definition, exports, configuration
 */

import { agentService } from './services/agent.service';
import { moduleTip } from './description/module.tip';

export const AgentModule = {
  name: 'AgentModule',
  service: agentService,
  tip: moduleTip,
};

export * from './types/agent.types';
export * from './services/agent.service';
