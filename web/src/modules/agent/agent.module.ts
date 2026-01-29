/**
 * @title Agent Module Definition
 * @description Exports and configuration for the Agent module.
 * @keywords-cn 模块定义, 导出, 配置
 * @keywords-en module-definition, exports, configuration
 */

import { moduleTip } from './description/module.tip';
import * as AgentConstants from './constants/agent.constants';
import * as AgentHooks from './hooks/useAgentChat';
import * as AgentThreadsHooks from './hooks/useAgentThreads';
import * as AgentCheckpointsHooks from './hooks/useAgentCheckpoints';
import * as AgentGroupsHooks from './hooks/useAgentGroups';
import * as AgentsHooks from './hooks/useAgents';
import * as QuickItemsHooks from './hooks/useAgentQuickItems';
import { agentApi } from '../../api/agent';

export const AgentModule = {
  name: 'AgentModule',
  tip: moduleTip,
  constants: AgentConstants,
  hooks: {
    chat: AgentHooks,
    sessions: AgentThreadsHooks,
    threads: AgentThreadsHooks,
    groups: AgentGroupsHooks,
    agents: AgentsHooks,
    quickItems: QuickItemsHooks,
    checkpoints: AgentCheckpointsHooks,
  },
  api: agentApi,
};

export * from './types/agent.types';
export * from './enums/agent.enums';
export * from './entities/agent.entity';
export * from './cache/agent.cache';
export * from './constants/agent.constants';
export * from './hooks/useAgentChat';
export * from './hooks/useAgentThreads';
export * from './hooks/useAgentCheckpoints';
export * from './hooks/useAgentGroups';
export * from './hooks/useAgents';
export * from './hooks/useAgentQuickItems';
export * from '../../api/agent';
