# 知识模块（Knowledge Module）

## 功能描述

知识模块提供两类知识书本的管理与语义检索能力：
- **技能（skill）**：描述如何操作对应的 hook 能力
- **学识（lore）**：描述具体思路或直接录入的书本知识

每本书有目录（章节），章节存储 Markdown 内容；特殊的 **LM必读** 章节在获取任意章节时都会附带返回，用于强化 AI 记忆。

## 目录结构

```
src/app/knowledge/
├── controllers/
│   └── knowledge.controller.ts   # REST 控制器
├── entities/
│   ├── knowledge-book.entity.ts  # 书本实体
│   └── knowledge-chapter.entity.ts # 章节实体
├── enums/
│   └── knowledge.enums.ts        # 类型枚举
├── services/
│   └── knowledge.service.ts      # 核心服务
├── types/
│   └── knowledge.types.ts        # DTO & 接口
└── knowledge.module.ts           # NestJS 模块
```

## 核心文件与函数

### services/knowledge.service.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `createBook` | 创建知识书本 |
| `listBooks` | 获取书本列表 |
| `getBook` | 获取书本详情 |
| `updateBook` | 更新书本 |
| `deleteBook` | 删除书本（软删） |
| `createChapter` | 新增章节 |
| `updateChapter` | 更新章节 |
| `deleteChapter` | 删除章节（软删） |
| `getTocByBookIds` | 批量获取目录（不含内容） |
| `getChapterContent` | 获取章节内容（含 LM 必读） |
| `getBookInfoByIds` | 批量获取书本名称和描述 |
| `buildEmbedding` | 对描述进行向量化 |
| `vectorSearch` | 自然语言向量语义匹配 |

### controllers/knowledge.controller.ts

| 路由 | 方法 | 描述 |
|------|------|------|
| `POST /knowledge/books` | createBook | 创建书本 |
| `GET /knowledge/books` | listBooks | 列表（可按 type 过滤） |
| `GET /knowledge/books/:id` | getBook | 详情 |
| `PATCH /knowledge/books/:id` | updateBook | 更新 |
| `DELETE /knowledge/books/:id` | deleteBook | 删除 |
| `POST /knowledge/books/:id/embed` | buildEmbedding | 触发向量化 |
| `GET /knowledge/books/:id/chapters` | getBookChapters | 获取目录 |
| `POST /knowledge/books/:id/chapters` | createChapter | 新增章节 |
| `GET /knowledge/books/:id/chapters/:cid` | getChapterContent | 获取章节（含LM必读） |
| `PATCH /knowledge/chapters/:cid` | updateChapter | 更新章节 |
| `DELETE /knowledge/chapters/:cid` | deleteChapter | 删除章节 |
| `POST /knowledge/toc` | batchToc | 批量获取目录（Hook用） |
| `POST /knowledge/chapters/content` | batchChapterContent | 批量获取章节内容（Hook用） |
| `POST /knowledge/info` | batchInfo | 批量获取书本名称/描述（Hook用） |
| `POST /knowledge/search` | search | 语义向量匹配 |

## 函数哈希映射

| 函数 | Hash |
|------|------|
| `KnowledgeService.createBook` | `km_create_book_01` |
| `KnowledgeService.listBooks` | `km_list_books_02` |
| `KnowledgeService.getBook` | `km_get_book_03` |
| `KnowledgeService.updateBook` | `km_update_book_04` |
| `KnowledgeService.deleteBook` | `km_delete_book_05` |
| `KnowledgeService.createChapter` | `km_create_chap_06` |
| `KnowledgeService.updateChapter` | `km_update_chap_07` |
| `KnowledgeService.deleteChapter` | `km_delete_chap_08` |
| `KnowledgeService.getTocByBookIds` | `km_toc_09` |
| `KnowledgeService.getChapterContent` | `km_chap_content_10` |
| `KnowledgeService.getBookInfoByIds` | `km_book_info_11` |
| `KnowledgeService.buildEmbedding` | `km_embed_12` |
| `KnowledgeService.vectorSearch` | `km_vector_search_13` |
