import { KnowledgeBookType } from '../enums/knowledge.enums';
import type {
  KnowledgeBookInfo,
  KnowledgeChapterInfo,
} from '../types/knowledge.types';

/**
 * @title 本地知识库种子数据
 * @description 系统预置知识书本，只读，不可删除/修改。ID 以 `local_` 为前缀标识为本地数据。
 * @keywords-cn 本地知识, 预置书本, 只读, 种子数据
 * @keywords-en local-knowledge, preset-book, readonly, seed-data
 */

// ----------------------------------------------------------------
// 本地书本定义
// ----------------------------------------------------------------

/**
 * 对话 Hook 技能手册
 * @keyword-en conversation-hook-skill-book
 */
export const LOCAL_BOOK_CONVERSATION_HOOK: KnowledgeBookInfo = {
  id: 'local_conversation_hook_skill',
  type: KnowledgeBookType.SKILL,
  name: '对话 Hook 技能手册',
  description:
    '描述如何通过 call_hook 在 IM 对话中发送消息，包含 saas.app.conversation.sendMsg hook 的 payload 结构与使用场景。',
  creatorId: null,
  isEmbedded: false,
  active: true,
  tags: ['本地知识', '对话'],
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
};

/**
 * Web Control 技能手册
 * @keyword-en web-control-skill-book
 */
export const LOCAL_BOOK_WEB_CONTROL: KnowledgeBookInfo = {
  id: 'local_web_control_skill',
  type: KnowledgeBookType.SKILL,
  name: 'Web Control 技能手册',
  description:
    '描述如何通过 call_hook 控制支持 WebMCP 的前端页面，仅适用于已接入 Web MCP 的页面。',
  creatorId: null,
  isEmbedded: false,
  active: true,
  tags: ['本地知识', '前端控制', 'WebMCP'],
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
};

// ----------------------------------------------------------------
// 本地章节定义
// ----------------------------------------------------------------

/**
 * 对话 Hook 技能手册 — LM 必读章节
 * @keyword-en conversation-hook-lm-required-chapter
 */
export const LOCAL_CHAPTER_CONVERSATION_HOOK_LM: KnowledgeChapterInfo = {
  id: 'local_conversation_hook_skill_lm',
  bookId: 'local_conversation_hook_skill',
  title: 'LM必读',
  sortOrder: 0,
  isLmRequired: true,
  content: `# 对话 Hook 技能手册 — LM 必读

## saas.app.conversation.sendMsg

通过 \`call_hook\` 向 IM 会话发送消息。

### 调用方式

\`\`\`
call_hook(
  hookName = "saas.app.conversation.sendMsg",
  payload  = {
    sessionId:          string,  // 目标会话 ID（必填）
    content:            string,  // 消息文本内容（必填）
    senderPrincipalId:  string,  // 发送者 principal_id（必填）
    replyToId:          string   // 被回复的消息 ID（必填），固定为当前触发消息 ID，不可修改或编造
  }
)
\`\`\`

### 返回值

成功：\`{ status: "success", data: { messageId, sessionId } }\`
失败：\`{ status: "error", error: "<原因>" }\`

### 约束

- **replyToId 必须传入**：值固定为本轮被触发的消息 ID，不可省略或编造。
- **单条消息最多回复 4 次**：超出后 hook 将返回 error，停止发送。
- 直接 return 文字是无效的，必须通过 \`call_hook("saas.app.conversation.sendMsg", ...)\` 才能让用户收到消息。
- 可多次调用，模拟分段回复（如短句分段发送），但不超过 4 次。

### 使用场景

| 场景 | 说明 |
|------|------|
| 主动对话回复 | Agent 被触发后，通过本 hook 向用户发送回复 |
| 分段表达 | 将长回复分成多条短消息发送，模拟真实对话节奏 |
| 确认反馈 | 执行某任务后，通过本 hook 通知用户执行结果 |

---

## 📌 上下文不够时怎么办

> 默认上下文窗口不会装下整段会话历史。如果用户在引用过去的事、或你需要更早的对话才能理解当前请求，**不要凭空猜**。

本书还有一个非 LM 必读章节专门讲这件事：

| 章节 ID | 标题 | 作用 |
|---------|------|------|
| \`local_conversation_hook_skill_context_recovery\` | 获取缺失上下文 | 通过 \`smartTags / smartSearch / smartMessages\` 三个 hook 分层检索历史: 先看 keyword 全景, 再看分段 summary, 最后才精准展开成全消息, 不污染上下文窗口 |

**触发条件**：当下面任一情况出现时，先去读这个章节再行动：
- 用户说"上次说的那个" / "之前提到的" / "上周聊过的" 之类的指代
- 你需要某条历史细节才能回复, 但上下文里没有
- 用户问"我们讨论过 X 吗" 这类需要回看历史的问题

**禁止行为**：
- 不要假装记得然后乱编
- 不要直接调一个上下文里没出现过的 \`saas.app.conversation.smart*\` hook —— 先 \`saas.app.knowledge.getChapter\` 拿到该章节的完整 payload schema 再调

> ⚠️ 本手册仅描述 IM 对话层 hook，其他 hook（如 saas.app.conversation.webControl）请查阅对应技能手册。
`,
};

/**
 * 对话 Hook 技能手册 — 获取缺失上下文章节 (按需读, 非 LM 必读)
 * @keyword-en conversation-hook-context-recovery-chapter
 */
export const LOCAL_CHAPTER_CONVERSATION_HOOK_CONTEXT_RECOVERY: KnowledgeChapterInfo =
  {
    id: 'local_conversation_hook_skill_context_recovery',
    bookId: 'local_conversation_hook_skill',
    title: '获取缺失上下文',
    sortOrder: 1,
    isLmRequired: false,
    content: `# 获取缺失上下文 — 三步分层检索

> 当用户引用过去对话、或你需要早期消息才能理解当前请求时, **不要靠猜**。
> 本会话历史已被切成若干 \`smart\` 段 (5-10 条消息一段, 每段有 keywords + AI 摘要 summary)。
> 通过下面三步精准取回需要的部分, 不要把整段历史塞进上下文窗口。

---

## 流程

\`\`\`
  ① smartTags     拿当前 session 的 keyword 全景
       ↓
  ② smartSearch   按相关 keyword 找 smart 段, 看每段 summary 决定取哪几段
       ↓
  ③ smartMessages 按 smartId 精准展开成对应段的全消息
\`\`\`

**禁止跳步**: 不要直接 \`smartMessages\`, 因为你不知道哪些 smartId 是相关的;
不要直接 \`smartSearch\`, 因为你不知道该 session 里有哪些 keyword。

---

## ① saas.app.conversation.smartTags

\`\`\`
call_hook(
  hookName = "saas.app.conversation.smartTags",
  payload  = { sessionId: string }     // 当前会话 ID
)
\`\`\`

返回:

\`\`\`
{
  sessionId,
  totalSmarts: number,                 // 该 session 总共有多少 smart 段
  items: [
    { tag: string, count: number },    // 按频次倒序; tag 可能是中文或英文
    ...
  ]
}
\`\`\`

> 用法: 看 items 头部高频 tag, 与用户当前问题做语义对齐, 选 1-5 个最相关的 keyword 进入 ②。
> 如果 totalSmarts === 0, 说明该会话还没分析过 smart, 没历史可查, 不要继续 ②③。

---

## ② saas.app.conversation.smartSearch

\`\`\`
call_hook(
  hookName = "saas.app.conversation.smartSearch",
  payload  = {
    sessionId: string,
    keywords:  string[],               // 来自 ① 选的 1-5 个 keyword (任一命中即可)
    limit:     number                  // 可选, 默认/上限 50, 倒序时间
  }
)
\`\`\`

返回:

\`\`\`
{
  sessionId,
  items: [
    {
      smartId:        string,          // ③ 用这个 ID 精准取段
      summary:        string,          // AI 生成的分段摘要, 用它决定要不要展开
      keywords:       string[],
      startMessageId: string,
      endMessageId:   string,
      messageCount:   number,
      createdAt:      ISO timestamp
    },
    ...
  ]
}
\`\`\`

> 用法: 通读 summary, 选 1-3 个真正相关的 smartId 进入 ③。一段 5-10 条消息, 别贪多。

---

## ③ saas.app.conversation.smartMessages

\`\`\`
call_hook(
  hookName = "saas.app.conversation.smartMessages",
  payload  = {
    sessionId: string,
    smartIds:  string[]                // 来自 ② 的 smartId, 至少 1 个最多 20 个
  }
)
\`\`\`

返回:

\`\`\`
{
  sessionId,
  segments: [
    {
      smartId:        string,
      summary:        string | null,
      startMessageId: string,
      endMessageId:   string,
      messages: [
        {
          id:           string,
          senderId:     string | null,
          messageType:  string,        // text / notification / ...
          content:      string,
          replyToId:    string | null,
          createdAt:    ISO timestamp
        },
        ...
      ]
    },
    ...
  ]
}
\`\`\`

> 用法: 这是真实对话原文, 直接据此回复用户。
> sessionId 同时用作越权防护, 跨 session 的 smartId 会被自动过滤掉。

---

## 何时停下

如果走完 ① 发现 \`totalSmarts === 0\`, 或走完 ② 没有命中任何相关 segment,
**坦白告诉用户"我没有找到相关的历史记录"**, 不要硬编造内容。
`,
  };

/**
 * Web Control 技能手册 — LM 必读章节
 * @keyword-en web-control-lm-required-chapter
 */
export const LOCAL_CHAPTER_WEB_CONTROL_LM: KnowledgeChapterInfo = {
  id: 'local_web_control_skill_lm',
  bookId: 'local_web_control_skill',
  title: 'LM必读',
  sortOrder: 0,
  isLmRequired: true,
  content: `# Web Control 技能手册 — LM 必读

> ⚠️ **仅适用于已接入 Web MCP 的页面**。如果当前会话没有连接的前端页面，或前端页面未集成 WebMCP SDK，以下 hook 将返回 error。

## saas.app.conversation.webControl

向前端页面发送控制指令（setData / callEmit）。

### 调用方式

\`\`\`
call_hook(
  hookName = "saas.app.conversation.webControl",
  payload  = {
    sessionId: string,           // 当前会话 ID（必填）
    type:      "data" | "emit",  // 操作类型（必填）
    payload:   unknown,          // 传递给前端的参数（必填），由页面 Schema 决定结构
    timeout:   number            // 超时毫秒，默认 8000（可选）
  }
)
\`\`\`

### 返回值

成功：\`{ status: "success", data: { result, socketId } }\`
失败：\`{ status: "error", error: "<原因>" }\`

---

## saas.app.conversation.webControlPageinfo

获取当前会话页面注册的 Schema（了解页面支持哪些 data/emit 操作）。

\`\`\`
call_hook(
  hookName = "saas.app.conversation.webControlPageinfo",
  payload  = { sessionId: string }
)
\`\`\`

---

## saas.app.conversation.webControlData

实时获取前端某个 data key 的当前值。

\`\`\`
call_hook(
  hookName = "saas.app.conversation.webControlData",
  payload  = { sessionId: string, dataKey: string }
)
\`\`\`

---

## 推荐使用流程

1. 先调用 \`saas.app.conversation.webControlPageinfo\` 获取页面 Schema，了解页面结构。
2. 根据 Schema 确定操作目标，再调用 \`saas.app.conversation.webControl\` 下发指令。
3. 如需读取最新状态，使用 \`saas.app.conversation.webControlData\`。

## 使用场景

| 场景 | hook | 说明 |
|------|------|------|
| 表单自动填充 | saas.app.conversation.webControl (data) | AI 将结果写入前端表单字段 |
| 触发页面行为 | saas.app.conversation.webControl (emit) | 触发按钮点击、弹窗、刷新等事件 |
| 了解页面状态 | saas.app.conversation.webControlData | 读取当前输入值或状态变量 |
| 了解页面能力 | saas.app.conversation.webControlPageinfo | 首次控制前，先查询页面 Schema |
`,
};

// ----------------------------------------------------------------
// 聚合导出（便于服务层统一访问）
// ----------------------------------------------------------------

/**
 * 所有本地书本列表
 * @keyword-en all-local-books
 */
export const LOCAL_BOOKS: readonly KnowledgeBookInfo[] = [
  LOCAL_BOOK_CONVERSATION_HOOK,
  LOCAL_BOOK_WEB_CONTROL,
];

/**
 * 本地章节按 bookId 索引（Map<bookId, chapters[]>）
 * @keyword-en local-chapters-map
 */
export const LOCAL_CHAPTERS_BY_BOOK: ReadonlyMap<
  string,
  readonly KnowledgeChapterInfo[]
> = new Map([
  [
    'local_conversation_hook_skill',
    [
      LOCAL_CHAPTER_CONVERSATION_HOOK_LM,
      LOCAL_CHAPTER_CONVERSATION_HOOK_CONTEXT_RECOVERY,
    ],
  ],
  ['local_web_control_skill', [LOCAL_CHAPTER_WEB_CONTROL_LM]],
]);

/**
 * 本地章节按 chapterId 索引（Map<chapterId, chapter>）
 * @keyword-en local-chapters-by-id
 */
export const LOCAL_CHAPTERS_BY_ID: ReadonlyMap<string, KnowledgeChapterInfo> =
  new Map(
    [
      LOCAL_CHAPTER_CONVERSATION_HOOK_LM,
      LOCAL_CHAPTER_CONVERSATION_HOOK_CONTEXT_RECOVERY,
      LOCAL_CHAPTER_WEB_CONTROL_LM,
    ].map((c) => [c.id, c]),
  );

/**
 * 判断一个 ID 是否属于本地知识（前缀 `local_`）
 * @keyword-en is-local-knowledge-id
 */
export function isLocalKnowledgeId(id: string): boolean {
  return id.startsWith('local_');
}
