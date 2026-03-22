# Todo Module（待办管理模块）

## 功能描述

The Todo module provides a comprehensive task management system with follow-up records, comments, and timeline visualization. It supports creating, editing, and tracking todos with multiple followers and real-time status updates.

## 目录结构

```
web/src/modules/todo/
├── components/
│   ├── TodoList.vue              # 待办列表主组件
│   ├── TodoDetail.vue           # 待办详情编辑页
│   ├── TodoCard.vue             # 待办卡片组件
│   ├── CreateTodoModal.vue      # 新建待办弹窗
│   ├── AddFollowupModal.vue     # 添加跟进弹窗
│   ├── EditFollowupModal.vue    # 编辑跟进弹窗
│   ├── FollowupTimeline.vue     # 跟进时间轴组件
│   └── CommentList.vue          # 评论列表组件
├── constants/
│   └── todo.constants.ts         # 待办常量
├── enums/
│   └── todo.enums.ts             # 待办状态枚举
├── hooks/
│   └── useTodos.ts               # 待办 CRUD + 跟进 + 评论 Hook
├── types/
│   └── todo.types.ts             # 类型定义
└── todo.module.ts               # 模块定义
```

## 核心文件与函数

### hooks/useTodos.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `list` | 获取待办列表 |
| `get` | 获取单个待办 |
| `create` | 创建待办 |
| `update` | 更新待办 |
| `remove` | 删除待办 |
| `createFollowup` | 创建跟进记录 |
| `listFollowups` | 获取跟进记录列表 |
| `removeFollowup` | 删除跟进记录 |
| `updateFollowup` | 更新跟进记录 |
| `createComment` | 创建评论 |
| `listComments` | 获取评论列表 |
| `removeComment` | 删除评论 |

### components/TodoList.vue

主要区域：
- `header` - 标题 + 新建按钮
- `filters` - 状态筛选 + 搜索框
- `todo-grid` - 待办卡片网格
- `create-modal` - 新建待办弹窗
- `detail-view` - 详情编辑页

### components/TodoDetail.vue

布局结构：
- `breadcrumb` - 面包屑导航
- `left-card` - 左侧待办信息卡片
- `right-tabs` - 右侧Tab切换（编辑/跟进记录）

### components/FollowupTimeline.vue

- `timeline-line` - 时间轴竖线
- `timeline-nodes` - 时间轴节点
- `followup-cards` - 跟进内容卡片
- `comment-section` - 评论区域

## 函数哈希映射

| 函数 | Hash |
|------|------|
| `listTodos` | `hash_listTodos_001` |
| `createTodo` | `hash_createTodo_002` |
| `updateTodo` | `hash_updateTodo_003` |
| `deleteTodo` | `hash_deleteTodo_004` |
| `createFollowup` | `hash_createFollowup_005` |
| `createComment` | `hash_createComment_006` |
| `useTodos_list` | `hash_hook_todo_list_001` |
| `useTodos_get` | `hash_hook_todo_get_002` |
| `useTodos_create` | `hash_hook_todo_create_003` |
| `useTodos_update` | `hash_hook_todo_update_004` |
| `useTodos_remove` | `hash_hook_todo_remove_005` |
| `useTodos_createFollowup` | `hash_hook_todo_followup_006` |
| `useTodos_createComment` | `hash_hook_todo_comment_007` |
