# Runner Module（Runner 管理模块）

## 功能描述

Runner 前端模块提供管理页、CRUD hook 与 API 对接能力。

## 目录结构

```
src/modules/runner/
├── components/
│   └── RunnerManagement.vue       # Runner 管理组件
├── constants/
│   └── runner.constants.ts       # Runner 常量
├── hooks/
│   └── useRunners.ts             # Runner Hook
├── pages/
│   └── RunnerPage.vue            # Runner 页面
├── types/
│   └── runner.types.ts           # 类型定义
└── runner.module.ts               # 模块定义
```

## 核心文件与函数

### hooks/useRunners.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `list` | 获取 Runner 列表 |
| `create` | 创建 Runner |
| `update` | 更新 Runner |
| `remove` | 删除 Runner |

### components/RunnerManagement.vue

主要区域：
- `runner-list` - Runner 列表
- `runner-form` - Runner 表单
- `status-indicator` - 状态指示器

## 函数哈希映射

| 函数 | Hash |
|------|------|
| `useRunners_list` | `web_runner_hook_list_001` |
| `useRunners_create` | `web_runner_hook_create_002` |
| `useRunners_update` | `web_runner_hook_update_003` |
| `useRunners_remove` | `web_runner_hook_remove_004` |
| `RunnerManagement_submit` | `web_runner_cmp_submit_005` |
