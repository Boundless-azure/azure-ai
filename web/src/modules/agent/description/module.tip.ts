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
    },
    en: {
      agent_service: 'agent.service.ts',
      workflow_types: 'agent.types.ts',
      chat_panel: 'ChatPanel.vue',
      sidebar: 'Sidebar.vue',
      right_panel: 'RightPanel.vue',
      workspace: 'AgentWorkspace.vue',
      closeable_tabs: 'RightPanel.vue',
      i18n: 'useI18n.ts',
      language_modal: 'LanguageModal.vue',
      date_picker_modal: 'DatePickerModal.vue',
      more_menu: 'MorePanel.vue',
      mobile_responsive: 'AgentWorkspace.vue',
      dashboard: 'RightPanel.vue',
    },
  },
  hashMap: {
    getHandle: 'hash_getHandle_001',
    getChatHistory: 'hash_getChatHistory_002',
    getWorkflowSteps: 'hash_getWorkflowSteps_003',
    getQuickItems: 'hash_getQuickItems_004',
  },
};
