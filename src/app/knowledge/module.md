# 知识模块（Knowledge Module）

## 功能描述

知识模块提供两类知识书本的管理与语义检索能力：
- **技能（skill）**：描述如何操作对应的 hook 能力
- **学识（lore）**：描述具体思路或直接录入的书本知识

每本书有目录（章节），章节存储 Markdown 内容；特殊的 **LM必读** 章节在获取任意章节时都会附带返回，用于强化 AI 记忆。

支持**本地预置书本**（文件声明，前缀 `local_`）与**数据库书本**两类数据，本地预置不可删除/修改。

## 目录结构

```
src/app/knowledge/
├── controllers/
│   └── knowledge.controller.ts         # REST 控制器
├── entities/
│   ├── knowledge-book.entity.ts        # 书本实体
│   └── knowledge-chapter.entity.ts    # 章节实体
├── enums/
│   └── knowledge.enums.ts             # 类型枚举
├── local/
│   └── local-knowledge.seed.ts        # 本地预置书本/章节声明
├── services/
│   ├── knowledge.service.ts           # 核心服务（含本地合并）
│   └── knowledge-hook-handler.service.ts # Hook 处理器（LLM 知识查询）
├── types/
│   └── knowledge.types.ts             # DTO & 接口
└── knowledge.module.ts                # NestJS 模块
```

## 本地预置书本

| ID | 名称 | 类型 |
|----|------|------|
| `local_conversation_hook_skill` | 对话 Hook 技能手册 | skill |
| `local_web_control_skill` | Web Control 技能手册 | skill |

## 核心文件与函数

### services/knowledge.service.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `createBook` | 创建知识书本（支持 tags） |
| `listBooks` | 获取书本列表（含本地预置） |
| `getBook` | 获取书本详情（含本地预置） |
| `updateBook` | 更新书本（本地预置不可修改，支持 tags） |
| `deleteBook` | 删除书本（软删，本地预置不可删除） |
| `createChapter` | 新增章节 |
| `updateChapter` | 更新章节（本地预置不可修改） |
| `deleteChapter` | 删除章节（软删，本地预置不可删除） |
| `getTocByBookIds` | 批量获取目录（不含内容，含本地预置） |
| `getChapterContent` | 获取章节内容（含 LM 必读，含本地预置） |
| `getBookInfoByIds` | 批量获取书本名称和描述（含本地预置） |
| `listByTags` | 按 tag 过滤返回书本列表（最多 100 条） |
| `listAllTags` | 列举所有 tag 频次榜（默认/上限 400, 聚合 db + 本地预置, 用于 LLM 发现起点） |
| `buildEmbedding` | 对描述进行向量化 |
| `vectorSearch` | 自然语言向量语义匹配（内部保留，不再对外 Hook 暴露） |

### services/knowledge-hook-handler.service.ts

全部声明 `payloadSchema` (zod, SSOT), handler 签名通过 `z.infer` 复用类型, invoker 在执行前自动校验。

| 函数名 | Hook 名 | payload | 关键词描述 |
|--------|---------|---------|-----------|
| `handleGetTag` | `saas.app.knowledge.getTag` | type? / cursor? / limit? | 知识库 tag 频次榜 (默认/上限 400) |
| `handleGetToc` | `saas.app.knowledge.getToc` | bookIds[] | 通过 bookIds 获取目录 |
| `handleGetChapter` | `saas.app.knowledge.getChapter` | bookIds[] / chapterIds? | 获取章节内容 (含 LM 必读) |
| `handleSearch` | `saas.app.knowledge.search` | tags? / type? / limit? | 按 tag 过滤列举书本 (前 100 条) |

### local/local-knowledge.seed.ts

| 导出 | 描述 |
|------|------|
| `LOCAL_BOOKS` | 所有本地书本列表 |
| `LOCAL_CHAPTERS_BY_BOOK` | 本地章节按 bookId 索引 |
| `LOCAL_CHAPTERS_BY_ID` | 本地章节按 chapterId 索引 |
| `isLocalKnowledgeId` | 判断 ID 是否为本地预置 |

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
| `POST /knowledge/search` | search | 按 tag 过滤列举书本（最多 100 条） |

| `KnowledgeService.getTocByBookIds` | `km_toc_09` |
| `KnowledgeService.getChapterContent` | `km_chap_content_10` |
| `KnowledgeService.getBookInfoByIds` | `km_book_info_11` |
| `KnowledgeService.buildEmbedding` | `km_embed_12` |
| `KnowledgeService.vectorSearch` | `km_vector_search_13` |
