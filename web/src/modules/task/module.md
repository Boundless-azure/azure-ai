# Task Module（任务管理模块）

## 功能描述

任务模块提供任务列表、任务详情编辑、任务关联 Todo 展示以及任务资源浏览能力。模块支持维护任务名称、描述、关联人、里程碑、PM、文件夹路径和所属 Session。

## 目录结构

```text
web/src/modules/task/
├── components/
│   ├── TaskList.vue
│   ├── TaskDetail.vue
│   ├── CreateTaskModal.vue
│   └── TaskFolderPickerModal.vue
├── hooks/
│   └── useTasks.ts
├── types/
│   └── task.types.ts
└── task.module.ts
```

## 核心文件与函数

### hooks/useTasks.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `list` | 获取任务列表，支持 sessionId / pmId / assigneeId / q 过滤 |
| `get` | 获取单个任务详情 |
| `create` | 创建任务 |
| `update` | 更新任务 |
| `remove` | 删除任务 |

### components/TaskList.vue

主要区域：
- `header` - 标题与新建按钮
- `filters` - 搜索与 session 过滤
- `task-table` - 任务表格
- `task-detail` - 任务详情页入口

### components/TaskDetail.vue

布局结构：
- `summary-card` - 左侧任务摘要
- `detail-tab` - 任务详情编辑
- `todos-tab` - 任务下的 Todo 列表
- `resources-tab` - 任务资源浏览

## 函数哈希映射

| 函数 | Hash |
|------|------|
| `useTasks.list` | `task_hook_list_001` |
| `useTasks.create` | `task_hook_create_002` |
| `TaskList.handleRefresh` | `task_list_refresh_003` |
| `TaskDetail.loadTodos` | `task_detail_todos_004` |
| `TaskDetail.loadResources` | `task_detail_resources_005` |
