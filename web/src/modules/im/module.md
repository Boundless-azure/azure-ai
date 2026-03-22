# IM Module（即时通讯模块）

## 功能描述

IM 前端模块提供实时聊天的 Socket 服务、组合函数与状态管理，包括房间加入/离开、输入状态、已读回执、增量拉取等能力。

## 目录结构

```
src/modules/im/
├── constants/
│   └── im.constants.ts            # IM 常量（无限重连配置）
├── description/
│   └── module.tip.ts              # 模块提示（开发用）
├── hooks/
│   └── im.hooks.ts                # IM Hook
├── services/
│   └── im.socket.service.ts       # IM Socket 服务
├── store/
│   └── im.store.ts                # IM 状态管理
├── types/
│   └── im.types.ts                # 类型定义
└── im.module.ts                   # 模块定义
```

## 核心文件与函数

### services/im.socket.service.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `connect` | 连接 IM 服务 |
| `reconnect` | 重连机制 |
| `joinRoom` | 加入房间 |
| `leaveRoom` | 离开房间 |
| `sendTyping` | 发送输入状态 |
| `sendRead` | 发送已读回执 |
| `joinNotify` | 加入通知 |
| `leaveNotify` | 离开通知 |

### store/im.store.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `loadSessionsInitial` | 初始加载会话 |
| `pullSessionsIncremental` | 增量拉取会话 |
| `loadMessagesInitial` | 初始加载消息 |
| `pullMessagesIncremental` | 增量拉取消息 |
| `openSession` | 打开会话 |
| `sendMessage` | 发送消息 |

## 函数哈希映射

| 函数 | Hash |
|------|------|
| `im_socket_connect` | `hash_im_socket_connect_001` |
| `im_socket_reconnect_options` | `hash_im_socket_reconnect_options_001a` |
| `im_socket_join_room` | `hash_im_socket_join_room_002` |
| `im_socket_leave_room` | `hash_im_socket_leave_room_003` |
| `im_socket_join_notify` | `hash_im_socket_join_notify_004` |
| `im_socket_leave_notify` | `hash_im_socket_leave_notify_005` |
| `im_socket_send_typing` | `hash_im_socket_send_typing_006` |
| `im_socket_send_read` | `hash_im_socket_send_read_007` |
| `im_store_load_sessions_initial` | `hash_im_store_load_sessions_008` |
| `im_store_pull_sessions_incremental` | `hash_im_store_pull_sessions_009` |
| `im_store_load_messages_initial` | `hash_im_store_load_messages_010` |
| `im_store_pull_messages_incremental` | `hash_im_store_pull_messages_011` |
| `im_store_open_session` | `hash_im_store_open_session_012` |
| `im_store_send_message` | `hash_im_store_send_message_013` |
