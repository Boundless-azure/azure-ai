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
    '描述如何通过 call_hook 在 IM 对话中发送消息，包含 send_msg hook 的 payload 结构与使用场景。',
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

## send_msg

通过 \`call_hook\` 向 IM 会话发送消息。

### 调用方式

\`\`\`
call_hook(
  hookName = "send_msg",
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
- 直接 return 文字是无效的，必须通过 \`call_hook("send_msg", ...)\` 才能让用户收到消息。
- 可多次调用，模拟分段回复（如短句分段发送），但不超过 4 次。

### 使用场景

| 场景 | 说明 |
|------|------|
| 主动对话回复 | Agent 被触发后，通过本 hook 向用户发送回复 |
| 分段表达 | 将长回复分成多条短消息发送，模拟真实对话节奏 |
| 确认反馈 | 执行某任务后，通过本 hook 通知用户执行结果 |

> ⚠️ 本手册仅描述 IM 对话层 hook，其他 hook（如 web_control）请查阅对应技能手册。
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

## web_control

向前端页面发送控制指令（setData / callEmit）。

### 调用方式

\`\`\`
call_hook(
  hookName = "web_control",
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

## web_control_pageinfo

获取当前会话页面注册的 Schema（了解页面支持哪些 data/emit 操作）。

\`\`\`
call_hook(
  hookName = "web_control_pageinfo",
  payload  = { sessionId: string }
)
\`\`\`

---

## web_control_data

实时获取前端某个 data key 的当前值。

\`\`\`
call_hook(
  hookName = "web_control_data",
  payload  = { sessionId: string, dataKey: string }
)
\`\`\`

---

## 推荐使用流程

1. 先调用 \`web_control_pageinfo\` 获取页面 Schema，了解页面结构。
2. 根据 Schema 确定操作目标，再调用 \`web_control\` 下发指令。
3. 如需读取最新状态，使用 \`web_control_data\`。

## 使用场景

| 场景 | hook | 说明 |
|------|------|------|
| 表单自动填充 | web_control (data) | AI 将结果写入前端表单字段 |
| 触发页面行为 | web_control (emit) | 触发按钮点击、弹窗、刷新等事件 |
| 了解页面状态 | web_control_data | 读取当前输入值或状态变量 |
| 了解页面能力 | web_control_pageinfo | 首次控制前，先查询页面 Schema |
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
  ['local_conversation_hook_skill', [LOCAL_CHAPTER_CONVERSATION_HOOK_LM]],
  ['local_web_control_skill', [LOCAL_CHAPTER_WEB_CONTROL_LM]],
]);

/**
 * 本地章节按 chapterId 索引（Map<chapterId, chapter>）
 * @keyword-en local-chapters-by-id
 */
export const LOCAL_CHAPTERS_BY_ID: ReadonlyMap<string, KnowledgeChapterInfo> =
  new Map(
    [LOCAL_CHAPTER_CONVERSATION_HOOK_LM, LOCAL_CHAPTER_WEB_CONTROL_LM].map(
      (c) => [c.id, c],
    ),
  );

/**
 * 判断一个 ID 是否属于本地知识（前缀 `local_`）
 * @keyword-en is-local-knowledge-id
 */
export function isLocalKnowledgeId(id: string): boolean {
  return id.startsWith('local_');
}
