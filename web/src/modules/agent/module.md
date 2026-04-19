# Agent Module（Agent 管理模块）

## 功能描述

The Agent module provides the main workspace for the AI agent, including chat, workflow visualization, and quick access tools.

## 目录结构

```
src/modules/agent/
├── api/
│   └── agent.ts                    # Agent API 封装
├── cache/
│   ├── agent.cache.ts             # Agent 缓存
│   ├── chat-history.cache.ts      # 聊天历史缓存
│   └── im-config.cache.ts         # IM 配置缓存
├── components/
│   ├── AgentList.vue              # Agent 列表组件
│   ├── AgentWorkspace.vue          # Agent 工作区
│   ├── ChatDetail.vue             # 聊天详情
│   ├── ChatPanel.vue              # 聊天面板
│   ├── RightPanel.vue             # 右侧面板
│   ├── Sidebar.vue                # 侧边栏
│   └── chat/                      # 聊天子组件
│       ├── ChatContactAvatar.vue   # 通讯录头像
│       ├── ChatContactTitle.vue    # 通讯录标题
│       ├── ChatContactsPanel.vue   # 通讯录面板
│       ├── ChatDailyPanel.vue      # 日报面板
│       ├── ChatHomeHeader.vue      # 聊天主页头部
│       ├── ChatMessageList.vue     # 消息列表
│       ├── ChatSessionHeader.vue   # 会话头部
│       ├── ChatThreadList.vue      # 会话列表
│       └── InputArea.vue          # 输入区域
├── config/
│   └── tab.registry.ts            # 右侧面板 Tab 注册表
├── constants/
│   └── agent.constants.ts         # 常量定义
├── description/
│   └── module.tip.ts              # 模块提示（开发用）
├── entities/
│   └── agent.entity.ts            # Agent 实体
├── enums/
│   └── agent.enums.ts             # Agent 枚举
├── hooks/
│   ├── useAgentChat.ts            # 聊天 Hook
│   ├── useAgentCheckpoints.ts      # 检查点 Hook
│   ├── useAgentGroups.ts          # 分组 Hook
│   ├── useAgentQuickItems.ts       # 快捷项 Hook
│   ├── useAgentThreads.ts         # 会话 Hook
│   ├── useAgents.ts               # Agent 列表 Hook
│   └── useChatContacts.ts         # 通讯录 Hook
├── pages/
│   └── chat-panel/                # 聊天面板子页面
│       ├── ChatContactsPage.vue    # 通讯录页面
│       ├── ChatDailyPage.vue       # 日报页面
│       ├── ChatMessagesPage.vue    # 消息页面
│       └── ChatSessionsPage.vue    # 会话列表页面
├── services/
│   └── agent.service.ts           # Agent 服务
├── store/
│   ├── agent.store.ts             # Agent 状态
│   ├── panel.store.ts             # 面板状态
│   └── right-panel.store.ts       # 右侧面板状态
├── types/
│   └── agent.types.ts             # 类型定义
└── agent.module.ts                # 模块定义
```

## 核心文件与函数

### pages/chat-panel/ChatMessagesPage.vue

| 函数名 | 关键词描述 |
|--------|-----------|
| `sendMessage` | 发送消息（水容乐观发送，fire-and-forget，不锁定输入框） |
| `scrollToBottom` | 滚动到底部 |
| `openSessionAndLoadHistory` | 打开会话并加载历史 |
| `getPrincipalId` | 获取当前用户 principalId |
| `extractMentions` | 从文本提取 @提及 |

### components/chat/ChatMessageList.vue

| 函数名 | 关键词描述 |
|--------|-----------|
| `visibleMessages` | 虚拟窗口切片（最后 WINDOW_SIZE + 展开量） |
| `topPaddingPx` | 顶部占位高度（隐藏消息的估算高度） |
| `expandWindow` | 向上展开虚拟窗口并恢复滚动位置 |
| `setupObserver` | 初始化 IntersectionObserver 监听顶部哨兵 |
| `renderMarkdown` | 渲染 markdown（带 LRU 缓存，最多200条） |
| `markNewMessage` | 标记新消息以触发进场动画 |
| `handleAvatarClick` | 点击头像打开用户信息抽屉 |

### hooks/useAgentChat.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `send` | 发送消息 |
| `sendToThread` | 发送消息到指定会话 |

### hooks/useAgentThreads.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `list` | 获取会话列表 |
| `create` | 创建会话 |
| `update` | 更新会话 |

### hooks/useAgentGroups.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `list` | 获取分组列表 |
| `create` | 创建分组 |
| `remove` | 删除分组 |
| `summaries` | 获取分组摘要 |

### hooks/useChatContacts.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `loadContacts` | 加载通讯录 |
| `loadAgents` | 加载 Agent |
| `mentionCandidates` | 获取 @ 提及候选 |

### components/ChatPanel.vue

主要区域：
- `sidebar` - 侧边栏
- `chat-panel` - 聊天面板
- `right-panel` - 右侧面板

### components/chat/InputArea.vue

主要区域：
- `input-area` - 输入区域
- `emoji-picker` - 表情选择
- `voice-recording` - 语音录制
- `mention-suggestions` - @提及建议

## 函数哈希映射

| 函数 | Hash |
|------|------|
| `getChatHistory` | `hash_getChatHistory_002` |
| `getWorkflowSteps` | `hash_getWorkflowSteps_003` |
| `getQuickItems` | `hash_getQuickItems_004` |
| `startChatStream` | `hash_startChatStream_005` |
| `getSessionGroups` | `hash_getSessionGroups_006` |
| `listCheckpoints` | `hash_listCheckpoints_007` |
| `getCheckpointDetail` | `hash_getCheckpointDetail_008` |
| `createGroup` | `hash_createGroup_010` |
| `deleteGroup` | `hash_deleteGroup_009` |
| `listSessions` | `hash_listThreads_011` |
| `createSession` | `hash_createThread_012` |
| `updateSession` | `hash_updateThread_013` |
| `useAgentChat_send` | `hash_hook_chat_send_001` |
| `useAgentChat_sendToThread` | `hash_hook_chat_send_thread_002` |
| `useAgentSessions_list` | `hash_hook_sessions_list_003` |
| `useAgentSessions_create` | `hash_hook_sessions_create_004` |
| `useAgentGroups_list` | `hash_hook_groups_list_006` |
| `useAgentGroups_create` | `hash_hook_groups_create_007` |
| `useAgentGroups_remove` | `hash_hook_groups_remove_008` |
| `tabRegistry` | `web_agent_tab_registry_001` |
| `chat_history_cache_load` | `hash_chat_cache_load_001` |
| `chat_history_cache_merge` | `hash_chat_cache_merge_002` |
| `contacts_open_profile` | `hash_contacts_open_profile_001` |
| `contacts_close_profile` | `hash_contacts_close_profile_002` |
| `contacts_add_member` | `hash_contacts_add_member_003` |
| `contacts_remove_member` | `hash_contacts_remove_member_004` |
