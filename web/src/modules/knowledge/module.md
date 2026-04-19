# 知识模块（前端 Knowledge Module）

## 功能描述

知识书架前端模块：以书架视觉展示知识书本（技能/学识），支持增删改查、向量构建。
编辑器采用左侧目录树 + 右侧 Markdown 编辑/预览分屏布局，支持 LM 必读章节标记。

## 目录结构

```
web/src/modules/knowledge/
├── components/
│   ├── KnowledgeBookshelf.vue   # 书架主视图
│   └── KnowledgeEditor.vue     # 知识编辑器（左目录+右Markdown）
├── constants/
│   └── knowledge.constants.ts   # 事件名常量
├── hooks/
│   └── useKnowledge.ts          # CRUD + 向量 + 搜索 Hook
├── types/
│   └── knowledge.types.ts       # 类型定义
└── knowledge.module.ts          # 模块入口
```

## 核心文件与函数

### hooks/useKnowledge.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `listBooks` | 获取书本列表 |
| `getBook` | 获取书本详情 |
| `createBook` | 创建书本 |
| `updateBook` | 更新书本 |
| `deleteBook` | 删除书本 |
| `buildEmbedding` | 构建/更新向量 |
| `listChapters` | 获取书本目录 |
| `getChapterContent` | 获取章节内容（含LM必读） |
| `createChapter` | 创建章节 |
| `updateChapter` | 更新章节 |
| `deleteChapter` | 删除章节 |
| `search` | 语义向量匹配 |

### components/KnowledgeBookshelf.vue

主要区域：
- `header-area` - 标题 + 新建按钮
- `filter-tabs` - 类型筛选标签
- `bookshelf-grid` - 书架书本网格
- `book-spine` - 书本外观（颜色+书名）
- `action-buttons` - 书本操作（编辑/向量/删除）
- `create-modal` - 创建书本弹窗

### components/KnowledgeEditor.vue

主要区域：
- `editor-topbar` - 顶部导航（返回/书名/工具栏）
- `sidebar-toc` - 左侧章节目录
- `chapter-list` - 章节列表
- `editor-main` - 右侧分屏（markdown编辑 + 预览）
- `add-chapter-modal` - 新增章节弹窗

## 函数哈希映射

| 函数 | Hash |
|------|------|
| `useKnowledge.listBooks` | `km_fe_list_01` |
| `useKnowledge.createBook` | `km_fe_create_02` |
| `useKnowledge.buildEmbedding` | `km_fe_embed_03` |
| `useKnowledge.listChapters` | `km_fe_toc_04` |
| `useKnowledge.getChapterContent` | `km_fe_content_05` |
| `useKnowledge.search` | `km_fe_search_06` |
