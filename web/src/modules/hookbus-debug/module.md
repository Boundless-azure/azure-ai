# HookBus Debug Module（HookBus 调试模块）

## 功能描述

HookBus 调试前端模块提供连接、hook选择、payload调试与历史记录能力。

## 目录结构

```
src/modules/hookbus-debug/
├── components/
│   └── HookbusDebugWorkbench.vue  # 调试工作台
├── constants/
│   └── hookbus-debug.constants.ts # 调试常量
├── hooks/
│   └── useHookbusDebug.ts         # 调试 Hook
├── pages/
│   └── HookbusDebugPage.vue      # 调试页面
├── types/
│   └── hookbus-debug.types.ts    # 类型定义
└── hookbus-debug.module.ts        # 模块定义
```

## 核心文件与函数

### hooks/useHookbusDebug.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `connect` | 连接调试服务 |
| `sendDebug` | 发送调试请求 |

### components/HookbusDebugWorkbench.vue

主要区域：
- `connection-panel` - 连接面板
- `hook-selector` - Hook 选择器
- `payload-editor` - Payload 编辑器
- `history-list` - 历史记录

## 函数哈希映射

| 函数 | Hash |
|------|------|
| `useHookbusDebug_connect` | `web_hookbus_debug_connect_001` |
| `useHookbusDebug_sendDebug` | `web_hookbus_debug_send_002` |
| `HookbusDebugWorkbench_modal` | `web_hookbus_debug_modal_003` |
