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
  },
};

export function useI18n() {
  const t = (key: string) => {
    const keys = key.split('.');
    let value: Record<string, any> = translations[currentLocale.value];
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key;
      }
    }
    return value as unknown as string;
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
