# useImChatAdapter 模块说明

## 功能描述

IM 适配器 hook，用于将新版 IM 模块集成到 ChatPanel 组件。

## 关键词对照

| 中文     | 英文            | 文件                |
| -------- | --------------- | ------------------- |
| IM适配器 | im-adapter      | useImChatAdapter.ts |
| 会话映射 | session-mapping | useImChatAdapter.ts |
| 消息转换 | message-convert | useImChatAdapter.ts |

## 函数哈希表

| 函数名                    | 描述                              |
| ------------------------- | --------------------------------- |
| useImChatAdapter          | 主适配器 hook                     |
| mapSessionToThread        | ImSessionSummary → ThreadListItem |
| mapImMessageToChatMessage | ImMessageInfo → ChatMessage       |
