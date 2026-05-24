/**
 * @title Agent 常量
 * @description 统一的存储键、事件名与默认配置，供 hooks 与组件复用。
 * @keywords-cn 常量, 存储键, 事件名
 * @keywords-en constants, storage-keys, event-names
 */

export const AGENT_STORAGE_KEYS = {
  panel: 'agent_panel',
  workspace: 'agent_workspace',
  state: 'agent_state',
};

export const AGENT_EVENT_NAMES = {
  messageSent: 'agent:message-sent',
  groupListChanged: 'agent:group-list-changed',
};

export const AGENT_DEFAULTS = {
  pageSize: 50,
  includeSystemMessages: true,
};

export type AgentEventName = keyof typeof AGENT_EVENT_NAMES;
