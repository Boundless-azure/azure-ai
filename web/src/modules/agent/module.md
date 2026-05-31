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
│   ├── AgentList.vue              # Agent 列表组件 (含角色分配入口)
│   ├── AgentKnowledgeAssignModal.vue # Agent 知识分配弹窗
│   ├── AgentRoleAssignModal.vue   # Agent 角色分配 Modal (复用 identity membership)
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
│       ├── HookComponentRenderer.vue # Hook 组件动态渲染器
│       ├── hook-component-ctx.ts   # Hook 组件能力注入对象 (callHook/navigate/refresh)
│       └── InputArea.vue          # 输入区域
├── config/
│   └── tab.registry.ts            # 右侧面板 Tab 注册表
├── constants/
│   ├── agent.constants.ts         # 常量定义
│   └── fixed-entry.constants.ts   # 固定入口默认头像路径
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
| `scrollToBottom` | 滚动到底部（底部锚点 + 多帧校准，兼容深滚动区） |
| `shouldFollowBottom` | 判断当前是否需要继续跟随底部（包含发送后的强制跟随窗口） |
| `countNewMessageIds` | 计算消息快照中新增的消息数量，用于深历史区的新消息提醒 |
| `cancelProgrammaticBottomScroll` | 用户主动滚动/触摸时取消程序化置底保护 |
| `openSessionAndLoadHistory` | 打开会话并加载历史 |
| `getPrincipalId` | 获取当前用户 principalId |
| `extractMentions` | 从文本提取 @提及 |

### components/chat/ChatMessageList.vue

| 函数名 | 关键词描述 |
|--------|-----------|
| `visibleMessages` | 虚拟窗口切片（最后 WINDOW_SIZE + 展开量） |
| `topPaddingPx` | 顶部占位高度（隐藏消息的估算高度） |
| `expandWindow` | 向上展开虚拟窗口并恢复滚动位置 |
| `resetWindowToTail` | 主动置底/发送消息时收回虚拟窗口到尾部 |
| `setupObserver` | 初始化 IntersectionObserver 监听顶部哨兵 |
| `renderMarkdown` | 渲染 markdown（带 LRU 缓存，最多200条）；接收 messageId 经 md.render(env) 透传给 hook fence renderer，cacheKey 含 messageId | keywords: render-markdown, markdown-cache, message-id-env |
| `renderLazyGuardTags` | 渲染后端固定 lazy guard 标签为本地化状态卡 |
| `mountHookComponents` | 扫描 DOM 中 .hook-component-slot 占位，读 data-message-id + 解析 sessionId，动态挂载 HookComponentRenderer Vue 实例 | keywords: mount-hook-components, dynamic-vue-mount, hook-component-slot |
| `markNewMessage` | 标记新消息以触发进场动画 |
| `handleAvatarClick` | 点击头像打开用户信息抽屉 |
| `renderUserMarkdown` | 用户消息 markdown 渲染 (html=false 防 XSS), 让 `![]()` 出图、`[]()` 出链接 |
| `handleMessageClick` | 委托点击事件: 点 img 打开 ImageViewer (设置 previewUrl + previewAlt), 点 a 新窗口打开 |

### components/chat/ChatContactAvatar.vue

| 函数名 | 关键词描述 |
|--------|-----------|
| `getSingleAvatarVisualClass` | 有图片头像时去掉旧兜底底色，仅无图片时使用类型色块 |

### components/chat/ChatThreadList.vue

| 函数名 | 关键词描述 |
|--------|-----------|
| `getTranslateX` | 根据滑动状态计算 item 横向偏移；右侧操作区样式限制在 item 内容高度内 |

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

### constants/fixed-entry.constants.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `resolveFixedEntryAvatarUrl` | 解析 Azure AI 助手与系统通知固定入口默认头像路径 |

### components/AgentList.vue (Agent 角色分配入口)

| 函数名 | 关键词描述 |
|--------|-----------|
| `openRoleModal` | 打开 Agent 角色分配 Modal, 落点为 agent.principalId |
| `openKnowledgeModal` | 打开 Agent 知识分配 Modal, 落点为 agent.id |
| `closeRoleModal` | 关闭 Modal 并清理选中 Agent |
| `getAgentAvatarUrl` | 通过 Resource 模块统一图片路径解析 Agent 头像 |

### components/AgentKnowledgeAssignModal.vue

| 函数名 | 关键词描述 |
|--------|-----------|
| `bootstrap` | 并行加载知识书本列表与当前 Agent 的知识分配状态 |
| `toggleBook` | 切换自定义数据库知识的选中状态，本地知识保持固定选中 |
| `handlePageChange` | 切换知识分配弹窗当前页码 |
| `handleSave` | 保存 Agent 当前生效的知识分配 |

### components/AgentRoleAssignModal.vue

| 函数名 | 关键词描述 |
|--------|-----------|
| `bootstrap` | 加载组织、角色、当前成员关系 |
| `refreshMemberships` | 按 principalId 重拉成员关系 |
| `addRole` | 调用 useMemberships.add({organizationId, principalId, roleId}) |
| `removeRole` | 调用 useMemberships.remove(membershipId) |
| `formatRoleLabel` | owner/admin/member 中文映射展示 |
| `getOrgName` | organizationId → 组织名 |

### components/ChatPanel.vue

主要区域：
- `sidebar` - 侧边栏
- `chat-panel` - 聊天面板
- `right-panel` - 右侧面板

补充行为：
- 右侧面板现支持 `tasks` tab，对应任务列表页面入口

### components/ChatTodos.vue

| 函数名 | 关键词描述 |
|--------|-----------|
| `loadTodos` | 从真实 Todo 接口按 sessionId 加载当前会话待办 |
| `toggleCompleted` | 切换待办完成状态 |

### components/ChatTasks.vue

| 函数名 | 关键词描述 |
|--------|-----------|
| `loadTasks` | 从真实 Task 接口按 sessionId 加载当前会话任务 |
| `formatAssignees` | 将会话任务关联人数组格式化为展示文案 |

### components/ChatFiles.vue

| 函数名 | 关键词描述 |
|--------|-----------|
| `loadResources` | 按 sessionId 从 resources 表加载会话文件 |
| `formatSize` | 格式化资源文件大小 |
| `fileMeta` | 根据资源类型映射文件图标和配色 |

### components/AgentWorkspace.vue

| 函数名 | 关键词描述 |
|--------|-----------|
| `toggleSidebarMenu` | 从聊天首页左上角菜单按钮切换后台菜单抽屉，移动端使用动态视口高度避免抽屉底部操作区被遮挡 |

### components/chat/HookComponentRenderer.vue

| 函数名 | 关键词描述 |
|--------|-----------|
| `fetchAndMount` | 根据 actionHook 拉取组件 JS（Bearer token 鉴权，Blob URL 缓存），动态 import 并调用 render(shadowRoot, payload, ctx)，组件渲染进 Shadow DOM 实现样式隔离，注入 ctx 能力对象 | keywords: hook-component-renderer, dynamic-component, offline-state, solution-component, style-isolation, shadow-dom |
| `ensureShadowRoot` | 在挂载元素上获取/创建 open shadow root 并清空、注入 box-sizing base reset，返回组件 render 写入的隔离容器 | keywords: ensure-shadow-root, shadow-base-reset |
| `onNavigate` | 监听 window `hookComponent:navigate` CustomEvent，调用 useRightPanelStore().openTab() 跳转右侧面板 Tab；旧组件直接 window 派发的兼容通道（新组件走 ctx.navigate） | keywords: hook-component-navigate-handler, right-panel-navigate |

### components/chat/hook-component-ctx.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `createHookComponentCtx` | 构造组件能力注入对象（callHook/navigate/refresh + messageId/sessionId），由 HookComponentRenderer 作 render 第三参传入；全异步可序列化，为 iframe 沙箱预留接缝 | keywords: create-hook-component-ctx, hook-component-ctx, capability-injection |
| `invokeHook` | 经 POST /hook-invoke 按 hook 名调用，token 由 http 拦截器统一附加，返回 {ok,data,errorMsg} | keywords: invoke-hook, unified-requester, call-hook |
| `invokeHookBatch` | 批量调用 hook（Phase 1 客户端 Promise.all 并发，结果按 hookName 对齐回带） | keywords: invoke-hook-batch, batch-calls |

### components/chat/ChatHomeHeader.vue

| 函数名 | 关键词描述 |
|--------|-----------|
| `openMenu` | 点击左上角黑白菜单按钮，向外触发打开后台菜单 |

### components/Sidebar.vue

布局说明：移动端侧栏中间菜单区允许纵向滚动，底部语言、设置、账号与退出操作保留安全区留白，避免小屏设备被挤出可视区。

补充行为：菜单区新增 `tasks` 入口，与 `todos` 并列显示任务列表页面。

| 函数名 | 关键词描述 |
|--------|-----------|
| `handleLogout` | 后台侧边栏退出登录，清理认证会话并返回登录页 |

### components/chat/InputArea.vue

主要区域：
- `input-area` - 输入区域
- `emoji-picker` - 表情选择
- `voice-recording` - 语音录制
- `mention-suggestions` - @提及建议

| 函数名 | 关键词描述 |
|--------|-----------|
| `triggerFileInput` | 打开文件选择器, 无 accept 限制, 接受任意类型 (后端按白名单 mime 决定 inline/attachment) |
| `handleFileSelect` | 选中文件入队: 图片走 FileReader 生成 base64 预览, 非图片仅记录 File 元信息显示通用文件图标 |
| `handlePaste` | 剪贴板粘贴: 图片走预览路径, 其它 file kind 直接进入附件列表 |
| `removeAttachment` | 从附件队列移除指定项 |
| `send` | 发送消息, 把附件队列连同文本 emit 给父组件 |

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
| `resolveFixedEntryAvatarUrl` | `agent_fixed_entry_avatar_001` |
| `getAgentAvatarUrl` | `agent_avatar_image_url_001` |
| `handleLogout` | `agent_sidebar_logout_001` |
| `getSingleAvatarVisualClass` | `chat_contact_avatar_visual_001` |
| `getTranslateX` | `chat_thread_translate_001` |
| `openMenu` | `chat_home_header_open_menu_001` |
| `toggleSidebarMenu` | `agent_workspace_sidebar_menu_001` |
| `loadTodos` | `chat_todos_load_001` |
| `createTodo` | `chat_todos_create_002` |
| `toggleCompleted` | `chat_todos_toggle_003` |
| `loadResources` | `chat_files_load_resources_001` |
| `formatSize` | `chat_files_format_size_002` |
| `fileMeta` | `chat_files_meta_003` |
