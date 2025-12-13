/**
 * @title Agent Module Tip
 * @description Description and mapping for the Agent module.
 * @keywords-cn 模块描述, 关键词映射, 哈希对照
 * @keywords-en module-description, keyword-mapping, hash-map
 */

export const moduleTip = {
  description:
    'The Agent module provides the main workspace for the AI agent, including chat, workflow visualization, and quick access tools.',
  keywords: {
    cn: {
      代理服务: 'agent.service.ts',
      工作流类型: 'agent.types.ts',
      聊天面板: 'ChatPanel.vue',
      对话WebSocket: 'services/agent.socket.service.ts',
      侧边栏: 'Sidebar.vue',
      右侧面板: 'RightPanel.vue',
      工作区: 'AgentWorkspace.vue',
      可关闭选项卡: 'RightPanel.vue',
      国际化: 'useI18n.ts',
      语言弹窗: 'LanguageModal.vue',
      日期选择弹窗: 'DatePickerModal.vue',
      更多菜单: 'MorePanel.vue',
      移动端适配: 'AgentWorkspace.vue',
      仪表盘: 'RightPanel.vue',
      工作流监控弹窗: 'WorkflowMonitorModal.vue',
      工作流图组件: 'WorkflowDiagram.vue',
      状态管理: 'store/agent.store.ts',
      会话切换弹窗: 'SessionSwitchModal.vue',
      代理控制器: 'controller/agent.controller.ts',
      代理枚举: 'enums/agent.enums.ts',
      代理实体: 'entities/agent.entity.ts',
      代理缓存: 'cache/agent.cache.ts',
    },
    en: {
      agent_service: 'services/agent.service.ts',
      workflow_types: 'types/agent.types.ts',
      chat_panel: 'components/ChatPanel.vue',
      conversation_ws: 'services/agent.socket.service.ts',
      sidebar: 'components/Sidebar.vue',
      right_panel: 'components/RightPanel.vue',
      workspace: 'components/AgentWorkspace.vue',
      closeable_tabs: 'components/RightPanel.vue',
      i18n: 'composables/useI18n.ts',
      language_modal: 'components/LanguageModal.vue',
      date_picker_modal: 'components/DatePickerModal.vue',
      more_menu: 'components/MorePanel.vue',
      mobile_responsive: 'components/AgentWorkspace.vue',
      dashboard: 'components/RightPanel.vue',
      workflow_monitor_modal: 'components/WorkflowMonitorModal.vue',
      workflow_diagram_component: 'components/WorkflowDiagram.vue',
      state_management: 'store/agent.store.ts',
      session_switch_modal: 'components/SessionSwitchModal.vue',
      agent_controller: 'controller/agent.controller.ts',
      agent_enums: 'enums/agent.enums.ts',
      agent_entities: 'entities/agent.entity.ts',
      agent_cache: 'cache/agent.cache.ts',
    },
  },
  hashMap: {
    getHandle: 'hash_getHandle_001',
    getChatHistory: 'hash_getChatHistory_002',
    getWorkflowSteps: 'hash_getWorkflowSteps_003',
    getQuickItems: 'hash_getQuickItems_004',
    startChatStream: 'hash_startChatStream_005',
    getSessionGroups: 'hash_getSessionGroups_006',
    listCheckpoints: 'hash_listCheckpoints_007',
    getCheckpointDetail: 'hash_getCheckpointDetail_008',
  },
};
