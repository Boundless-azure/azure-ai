import { ref } from 'vue';

const currentLocale = ref<'en' | 'cn'>('cn');

export const supportedLocales = [
  { code: 'en', label: 'English', icon: 'flag-usa' },
  { code: 'cn', label: '中文 (简体)', icon: 'flag' },
];

const translations = {
  en: {
    sidebar: {
      chat: 'AI Chat',
      projects: 'Projects',
      knowledge: 'Knowledge Base',
      tools: 'Tools',
      analytics: 'Analytics',
      settings: 'Settings',
      users: 'User Management',
      roles: 'Role Management',
      resources: 'Resource Library',
      database: 'Database Management',
      plugins: 'Plugin Management',
      agents: 'Agent Management',
      todos: 'Todo List',
      more: 'More',
      logs: 'System Logs',
      backup: 'Backups',
      security: 'Security',
      notifications: 'Notifications',
      integrations: 'Integrations',
      about: 'About',
    },
    dashboard: {
      welcome: 'Welcome back, User',
      welcomeSub: "Here's what's happening with your agents today.",
      newAgent: 'New Agent',
      activeAgents: 'Active Agents',
      tasksPending: 'Tasks Pending',
      workflows: 'Workflows',
      errors: 'Errors',
      quickAccess: 'Quick Access',
      tasksActivity: 'Tasks & Activity',
      notifications: 'Notifications',
      recentFiles: 'Recent Files',
      justNow: 'Just now',
      today: 'Today',
      emailPlugin: 'Email Plugin',
      taxiPlugin: 'Taxi Service',
      newEmail: 'New email received',
      taxiArriving: 'Your ride is arriving',
      emailContent:
        'Meeting scheduled for tomorrow at 10 AM regarding project updates...',
      taxiContent:
        'Driver Wang (Plate: A-12345) is 2 minutes away. Please be ready.',
      pluginNotifications: 'Plugin Updates',
      systemNotifications: 'System Notifications',
    },
    chat: {
      agentName: 'Assistant Agent',
      processing: 'Processing Request...',
      activeWorkflows: 'Processing {count} workflows',
      noActiveWorkflows: 'No active workflows',
      inputPlaceholder: 'Ask anything...',
      workflowStatus: 'Workflow Status',
      attachFile: 'Attach file',
      voiceInput: 'Voice input',
      stopRecording: 'Stop recording',
      footerDisclaimer:
        'AI can make mistakes. Please check important information.',
      emptyState: 'Start a conversation with the AI Assistant.',
    },
    tabs: {
      dashboard: 'Dashboard',
    },
    todo: {
      title: 'Todo List',
      allStatuses: 'All Statuses',
      empty: 'No todos',
      columns: {
        initiator: 'Initiator',
        title: 'Title',
        plugin: 'Plugin',
        description: 'Description',
        action: 'Action',
        recipient: 'Recipient',
        status: 'Status',
        receipt: 'Receipt',
        operations: 'Operations',
      },
      actions: {
        markRead: 'Mark Read',
        markDone: 'Mark Completed',
      },
      status: {
        unread: 'Unread',
        read: 'Read',
        completed: 'Completed',
        rejected: 'Rejected',
        failed: 'Failed',
      },
    },
    modal: {
      selectLanguage: 'Select Language',
      cancel: 'Cancel',
      confirm: 'Confirm',
      historyDate: 'History Date',
      selectDate: 'Select Date',
      chatSummary: 'Chat Summary',
      pendingTasks: 'Pending Tasks',
      pluginActivity: 'Plugin Activity',
      futureIsComing: 'The future is coming',
      exploreFuture: 'Explore the unknown possibilities ahead.',
    },
    monitor: {
      title: 'Workflow Monitor',
      subtitle: 'Real-time visualization of agent execution flows',
    },
    session: {
      switchGroup: 'Switch Conversation Group',
      noGroups: 'No conversation groups found.',
      selectGroupHint: 'Select a conversation group to view details',
      summary: 'Conversation Summary',
      noSummaries: 'No summaries available for this conversation.',
    },
    agent: {
      management: 'Agent Management',
      create: 'Create Agent',
      edit: 'Edit Agent',
      delete: 'Delete Agent',
      nickname: 'Nickname',
      purpose: 'Purpose',
      isAi: 'AI Generated',
      createdAt: 'Created At',
      actions: 'Actions',
      deleteConfirm: 'Are you sure you want to delete this agent?',
      save: 'Save',
      cancel: 'Cancel',
      search: 'Search Agents...',
      aiGenerated: 'Yes',
      manual: 'No',
    },
    common: {
      cancel: 'Cancel',
      confirm: 'Confirm',
      delete: 'Delete',
      confirmDelete: 'Are you sure you want to delete this item?',
    },
  },
  cn: {
    sidebar: {
      chat: 'AI 对话',
      projects: '项目管理',
      knowledge: '知识库',
      tools: '工具箱',
      analytics: '数据分析',
      settings: '设置',
      users: '用户管理',
      roles: '角色管理',
      resources: '资源库管理',
      database: '数据库管理',
      plugins: '插件管理',
      agents: 'Agent管理',
      todos: '待办事项',
      more: '更多菜单',
      logs: '系统日志',
      backup: '备份管理',
      security: '安全设置',
      notifications: '通知设置',
      integrations: '集成服务',
      about: '关于系统',
    },
    dashboard: {
      welcome: '欢迎回来, User',
      welcomeSub: '以下是您今天的代理服务动态。',
      newAgent: '新建代理',
      activeAgents: '活跃代理',
      tasksPending: '待办任务',
      workflows: '工作流',
      errors: '异常警告',
      quickAccess: '快捷访问',
      tasksActivity: '任务与动态',
      notifications: '消息通知',
      recentFiles: '最近文件',
      justNow: '刚刚',
      today: '今天',
      emailPlugin: '邮件插件',
      taxiPlugin: '打车服务',
      newEmail: '收到新邮件',
      taxiArriving: '您的车辆即将到达',
      emailContent: '关于项目进度的会议定于明天上午 10 点举行，请准时参加...',
      taxiContent: '王师傅 (车牌: 京A-12345) 距离您还有 2 分钟，请准备上车。',
      pluginNotifications: '插件通知',
      systemNotifications: '消息通知',
    },
    chat: {
      agentName: '智能助理',
      processing: '正在处理请求...',
      activeWorkflows: '正在处理 {count} 条工作流',
      noActiveWorkflows: '暂时无工作流处理',
      inputPlaceholder: '输入您的问题...',
      workflowStatus: '工作流状态',
      attachFile: '上传文件',
      voiceInput: '语音输入',
      stopRecording: '停止录音',
      footerDisclaimer: 'AI 模型可能会产生错误，请核对重要信息。',
      emptyState: '开启您与 AI 智能助理的对话之旅。',
    },
    tabs: {
      dashboard: '仪表盘',
    },
    todo: {
      title: '待办事项',
      allStatuses: '所有状态',
      empty: '暂无待办',
      columns: {
        initiator: '发起人',
        title: '待办名',
        plugin: '关联插件',
        description: '内容说明',
        action: '待办Action',
        recipient: '接收人',
        status: '待办状态',
        receipt: '回执结果',
        operations: '操作',
      },
      actions: {
        markRead: '标记已阅',
        markDone: '标记完成',
      },
      status: {
        unread: '未读',
        read: '已阅',
        completed: '已完成',
        rejected: '已拒绝',
        failed: '失败执行',
      },
    },
    modal: {
      selectLanguage: '选择语言',
      cancel: '取消',
      confirm: '确认',
      historyDate: '历史日期',
      selectDate: '选择日期',
      chatSummary: '对话摘要',
      pendingTasks: '待办事项',
      pluginActivity: '插件动态',
      futureIsComing: '未来将至',
      exploreFuture: '探索前方的未知可能',
    },
    monitor: {
      title: '工作流监控',
      subtitle: '实时可视化查看Agent执行流状态',
    },
    session: {
      switchGroup: '切换会话组',
      noGroups: '暂无会话组',
      selectGroupHint: '选择一个会话组以查看详情',
      summary: '对话摘要',
      noSummaries: '该对话暂无摘要',
    },
    agent: {
      management: 'Agent管理',
      create: '新建Agent',
      edit: '编辑Agent',
      delete: '删除Agent',
      nickname: '拟人昵称',
      purpose: '用途说明',
      isAi: 'AI生成',
      createdAt: '创建时间',
      actions: '操作',
      deleteConfirm: '确认删除该Agent吗？',
      save: '保存',
      cancel: '取消',
      search: '搜索Agent...',
      aiGenerated: '是',
      manual: '否',
    },
    common: {
      cancel: '取消',
      confirm: '确认',
      delete: '删除',
      confirmDelete: '确认删除该项目吗？',
    },
  },
};

export function useI18n() {
  const t = (key: string, params?: Record<string, string | number>) => {
    const keys = key.split('.');
    let value: Record<string, any> | string = translations[currentLocale.value];
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key;
      }
    }

    let result = value as unknown as string;
    if (params) {
      Object.keys(params).forEach((paramKey) => {
        result = result.replace(
          new RegExp(`{${paramKey}}`, 'g'),
          String(params[paramKey]),
        );
      });
    }
    return result;
  };

  const setLocale = (locale: 'en' | 'cn') => {
    currentLocale.value = locale;
  };

  const toggleLocale = () => {
    currentLocale.value = currentLocale.value === 'en' ? 'cn' : 'en';
  };

  return {
    currentLocale,
    t,
    toggleLocale,
    setLocale,
    supportedLocales,
  };
}
