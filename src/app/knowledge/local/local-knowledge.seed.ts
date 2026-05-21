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

/**
 * Saas 系统hook技能手册
 * @keyword-en saas-system-hook-skill-book
 */
export const LOCAL_BOOK_SAAS_SYSTEM_HOOK: KnowledgeBookInfo = {
  id: 'local_saas_system_hook_skill',
  type: KnowledgeBookType.SKILL,
  name: 'Saas 系统hook技能手册',
  description:
    '系统内置 SaaS 管理 hook 手册，覆盖鉴权管理、文件管理、解决方案、待办实现和 Runner 查询说明。',
  creatorId: null,
  isEmbedded: false,
  active: true,
  tags: [
    '本地知识',
    'SaaS',
    'Hook',
    '鉴权管理',
    '文件管理',
    '解决方案',
    '待办',
  ],
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
};

/**
 * Runner Hook 专用手册 (target=runner 路由的 hook 总览, 含数据触点等 runner 特有能力)
 * @keyword-en runner-hook-skill-book
 */
export const LOCAL_BOOK_RUNNER_HOOK: KnowledgeBookInfo = {
  id: 'local_runner_hook_skill',
  type: KnowledgeBookType.SKILL,
  name: 'Runner Hook 专用手册',
  description:
    'Runner 端 hook 调用手册 (call_hook target=runner). 覆盖 runner 特有能力 (数据触点 / unit-core / solution 本地执行), 以及 Runner 时区约定 (固定 UTC)。',
  creatorId: null,
  isEmbedded: false,
  active: true,
  tags: ['本地知识', 'Runner', 'Hook', '数据触点', '时区'],
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
};

// ----------------------------------------------------------------
// 本地章节定义
// ----------------------------------------------------------------

/**
 * 对话 Hook 技能手册 — LM必读章节
 * @keyword-en conversation-hook-lm-required-chapter
 */
export const LOCAL_CHAPTER_CONVERSATION_HOOK_LM: KnowledgeChapterInfo = {
  id: 'local_conversation_hook_skill_lm',
  bookId: 'local_conversation_hook_skill',
  title: 'LM必读',
  sortOrder: 0,
  isLmRequired: true,
  content: `# 对话 Hook 技能手册 — LM必读

## saas.app.conversation.sendMsg

通过 \`call_hook\` 向 IM 会话发送消息。

> ⚠️ **payload 形态注意** :: SaaS hook 统一使用 \`@HookController/@HookRoute\` 数组形参。
> payload 必须是数组: 单参 \`[{ ...字段 }]\`, 多参 \`[arg1, arg2]\`。

### 调用方式

\`\`\`
call_hook(
  hookName = "saas.app.conversation.sendMsg",
  payload  = [{
    sessionId:          string,  // 目标会话 ID（必填）
    content:            string,  // 消息文本内容（必填）
    senderPrincipalId:  string,  // 发送者 principal_id（必填）
    replyToId:          string   // 被回复的消息 ID（必填），固定为当前触发消息 ID，不可修改或编造
  }]
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

本书还有一个非 LM必读章节专门讲这件事：

| 章节 ID | 标题 | 作用 |
|---------|------|------|
| \`local_conversation_hook_skill_context_recovery\` | 获取缺失上下文 | 通过三个 hook (\`saas.app.conversation.smartTags\` → \`saas.app.conversation.smartSearch\` → \`saas.app.conversation.smartMessages\`) 分层检索历史: 先看 keyword 全景, 再看分段 summary, 最后才精准展开成全消息, 不污染上下文窗口 |

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
 * 对话 Hook 技能手册 — 获取缺失上下文章节 (按需读, 非 LM必读)
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

> ⚠ 全部 hook 名必须带 \`saas.app.conversation.\` 前缀, 短名 (\`smartTags\` 等) 不是合法 hook 名。

\`\`\`
  ① saas.app.conversation.smartTags     拿当前 session 的 keyword 全景
       ↓
  ② saas.app.conversation.smartSearch   按相关 keyword 找 smart 段, 看每段 summary 决定取哪几段
       ↓
  ③ saas.app.conversation.smartMessages 按 smartId 精准展开成对应段的全消息
\`\`\`

**禁止跳步**: 不要直接 \`saas.app.conversation.smartMessages\`, 因为你不知道哪些 smartId 是相关的;
不要直接 \`saas.app.conversation.smartSearch\`, 因为你不知道该 session 里有哪些 keyword。

---

## ① saas.app.conversation.smartTags

\`\`\`
call_hook(
  hookName = "saas.app.conversation.smartTags",
  payload  = [{ sessionId: string }]     // 当前会话 ID
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
  payload  = [{
    sessionId: string,
    keywords:  string[],               // 来自 ① 选的 1-5 个 keyword (任一命中即可)
    limit:     number                  // 可选, 默认/上限 50, 倒序时间
  }]
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
  payload  = [{
    sessionId: string,
    smartIds:  string[]                // 来自 ② 的 smartId, 至少 1 个最多 20 个
  }]
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
 * Web Control 技能手册 — LM必读章节
 * @keyword-en web-control-lm-required-chapter
 */
export const LOCAL_CHAPTER_WEB_CONTROL_LM: KnowledgeChapterInfo = {
  id: 'local_web_control_skill_lm',
  bookId: 'local_web_control_skill',
  title: 'LM必读',
  sortOrder: 0,
  isLmRequired: true,
  content: `# Web Control 技能手册 — LM必读

> ⚠️ **仅适用于已接入 Web MCP 的页面**。如果当前会话没有连接的前端页面，或前端页面未集成 WebMCP SDK，以下 hook 将返回 error。

## saas.app.conversation.webControl

向前端页面发送控制指令（setData / callEmit）。

### 调用方式

\`\`\`
call_hook(
  hookName = "saas.app.conversation.webControl",
  payload  = [{
    sessionId: string,           // 当前会话 ID（必填）
    type:      "data" | "emit",  // 操作类型（必填）
    payload:   unknown,          // 传递给前端的参数（必填），由页面 Schema 决定结构
    timeout:   number            // 超时毫秒，默认 8000（可选）
  }]
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
  payload  = [{ sessionId: string }]
)
\`\`\`

---

## saas.app.conversation.webControlData

实时获取前端某个 data key 的当前值。

\`\`\`
call_hook(
  hookName = "saas.app.conversation.webControlData",
  payload  = [{ sessionId: string, dataKey: string }]
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

/**
 * Saas 系统hook技能手册 — LM必读章节
 * @keyword-en saas-system-hook-lm-required-chapter
 */
export const LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_LM: KnowledgeChapterInfo = {
  id: 'local_saas_system_hook_skill_lm',
  bookId: 'local_saas_system_hook_skill',
  title: 'LM必读',
  sortOrder: 0,
  isLmRequired: true,
  content: `# Saas 系统 Hook 技能手册 — LM必读

本书是 SaaS 平台侧的系统能力导航。**LM必读只讲概念和该读哪个章节, 不在这里展开 hook name / payload**。

做系统管理类任务时, 不要凭名字猜能力, 先判断用户意图属于哪个业务概念, 再读取对应章节拿完整调用细节。

## 章节目录

| 章节名称 | 适用场景 |
|----------|----------|
| RBAC 权限管理 Hook | Agent 身份、用户/主体/组织/角色/成员关系、权限定义 |
| 文件管理 Hook | 资源库、文件节点、目录、复制、分享 |
| Solution 管理 Hook | Solution 是什么、跨 Runner 查询、安装/卸载、发布状态、标签 |
| 待办任务 Hook | 待办是什么、任务创建、负责人/关注人、状态流转、跟进记录、评论 |
| 时间数据操作 Hook | UTC、本地时区、展示时间、Runner 数据触点时间转换 |

## 先理解这些系统概念

### Agent 在该系统是什么

Agent 不是普通文本角色, 而是系统里的一个 \`principal\` 主体, 参与 RBAC 鉴权。它有自己的 \`principalId\`, 调 hook 时由服务端注入当前身份, 不要手工伪造 principalId。

Agent 能做什么, 取决于它所属组织、成员关系、角色和权限。遇到"这个 agent 能不能访问/管理某对象"、"给某人授权"、"查某用户角色"这类问题, 先读 **RBAC 权限管理 Hook** 章节。

### RBAC 权限管理是什么

RBAC 是系统的权限骨架: 用户/Agent/系统账号都是主体; 主体通过组织成员关系拿到角色; 角色绑定权限定义。权限不是靠 prompt 承诺, 而是 hook 执行时由后端校验。

处理用户、主体、组织、成员关系、角色、权限定义时, 不要猜表结构, 读 **RBAC 权限管理 Hook** 章节。

### Solution 是什么

Solution 是可部署/安装到 Runner 的应用或能力包。SaaS 侧负责聚合展示、安装/卸载编排、发布状态和基础元数据; Runner 侧负责本地执行和一些运行时能力。

当用户说"安装一个能力"、"查可用应用"、"某 Runner 上有什么方案"、"卸载/更新某方案"时, 先读 **Solution 管理 Hook** 章节。

### 待办是什么

待办是 SaaS 内的任务/事项对象, 用来记录谁发起、谁跟进、当前状态、描述内容和状态颜色等; 跟进记录和评论用于承载过程更新。它适合承载"提醒我做 X"、"给某人派任务"、"查有哪些未完成事项"这类轻量协作任务。

处理任务列表、创建任务、更新状态、分配关注人、补充跟进记录或评论时, 读 **待办任务 Hook** 章节。

### 时间数据一般用来干嘛

系统里存储和 Runner 内部运行通常以 UTC 为稳定基准; 用户看到的"今天"、"明天 9 点"、"本地时间"必须按用户所在 IANA 时区转换。

时间数据常用于:
- 把 UTC 时间展示成用户本地时间
- 把用户输入的本地时间转换成 UTC 存储/比较
- 数据触点、定时检查、跨地域 Runner 对齐时间
- 根据 IP 或用户资料推断时区

涉及时间判断、提醒、数据触点调度、本地展示时, 先读 **时间数据操作 Hook** 章节。

### 数据触点是什么

数据触点是 Runner 侧的长期数据探针: 它持续观察某个数据条件, 定时或被事件触发后运行胶水代码, 判断是否需要给用户发通知。

数据触点不是 SaaS 侧通用管理 hook, 它主要属于 Runner 端能力。只要用户提到"持续监控"、"达到条件提醒我"、"每天检查数据"、"数据异常主动通知", 必须转去读 **Runner Hook 专用手册** 的 **数据触点 (Data Touchpoint)** 章节。

## Runner 操作手册指向

Runner 必然存在一些基座支持的 hook, 例如数据触点、Runner 应用层能力、Unit Core 文件/Mongo/AST 等系统能力原语。这些不是本 SaaS 手册负责展开的内容。

当任务需要操作 Runner、创建数据触点、读取 Runner 本地能力、执行 Solution 运行时动作时:

1. 先读 **Runner Hook 专用手册** (bookId=\`local_runner_hook_skill\`) 的 **LM必读** 章节。
2. 如果是数据监控/长期探针, 继续读 **数据触点 (Data Touchpoint)** 章节。
3. 操作 Runner 时必须明确目标 Runner, SaaS 平台能力与 Runner 端能力不要混用。

## 调用形态 (统一数组形参)

SaaS hook 统一通过 hook-controller 声明, \`payload\` **必须是数组**。服务端会把数组按顺序展开成 controller 方法形参：

| 形态 | payload 结构 | controller 签名 |
|------|--------------|------------------|
| 单参 | \`[{ ...字段 }]\` | \`(queryOrBody)\` — 所有 \`*list\` / \`*create\` / 单 body 写操作 |
| id 单参 | \`["<id>"]\` | \`(id)\` — \`*get\` / \`*delete\` |
| id + body | \`["<id>", { ...body }]\` | \`(id, body)\` — \`*update\` 以及带 path id 的写操作 |

### ⚠️ id 必须独立放在 payload[0], 严禁塞进 body 对象

**反例**

\`\`\`json
[{ "id": "019d145e-a045-77f5-95b0-7d776640759c", "status": "failed" }]
\`\`\`

**正例**

\`\`\`json
["019d145e-a045-77f5-95b0-7d776640759c", { "status": "failed" }]
\`\`\`

**规则**:
- 单参查询/创建: \`payload: [{ ...字段 }]\`。
- 详情/删除: \`payload: ["<id 字符串>"]\`。
- 更新/安装/卸载等 id+body: \`payload: ["<id 字符串>", { ...body }]\`。
- 当前登录身份 (principalId/principalType) 由系统在 hook 调用末尾**自动追加**, **不要**手工写进 payload。

## 调用前先看 session_data

每轮起手协议要求先看本会话已有的 handbook / knowledge / recipe / hook / entity。命中 title 后再取完整内容。

不要自己主动写经验沉淀; 系统会在低频高价值事件后用独立沉淀 LLM 自动写入。

## 批量 + 并行

- 同回合多个独立查询, 应先规划依赖关系, 能并行的放到同一次 batch 调用里。
- 有依赖的任务分批: 先拿列表/目录/标签, 再根据返回 ID 取详情或执行写操作。
- 写操作只有互不覆盖、互不依赖时才并行; 涉及同一对象状态变更时按顺序执行。

## 权限与失败处理

- hook 存在 ≠ 当前会话有权限。\`@CheckAbility\` 校验失败 \`errorMsg\` 含 \`permission/ability/forbidden/unauthorized\` 字样。
- 看到这类错误**立即停止重试**，向用户说明缺少哪个权限即可。**不要**换 hook、runner、terminal 或伪造 principalId 绕权。
- 普通业务错误：先读 \`errorMsg\` 再决定是否调整 payload 重试，不要盲目重发。

## 其他对话 / 页面相关

- 主动发消息 / 历史检索：见对话 Hook 技能手册 (bookId=\`local_conversation_hook_skill\`)。SaaS hook 统一是数组形参，单参传 \`[{ ...字段 }]\`。
- 控制前端页面：见 Web Control 技能手册 (bookId=\`local_web_control_skill\`)，仅在已接入 WebMCP 的页面有效。
- Runner 侧能力：先读 Runner Hook 专用手册 (bookId=\`local_runner_hook_skill\`)。
`,
};

/**
 * Saas 系统hook技能手册 — RBAC 权限管理 Hook 章节
 * @keyword-en saas-system-hook-identity-chapter
 */
export const LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_IDENTITY: KnowledgeChapterInfo = {
  id: 'local_saas_system_hook_skill_identity',
  bookId: 'local_saas_system_hook_skill',
  title: 'RBAC 权限管理 Hook',
  sortOrder: 1,
  isLmRequired: false,
  content: `# RBAC 权限管理 Hook

identity 模块的全部 SaaS Hook，覆盖用户、主体、组织、成员关系、角色、权限定义、角色权限。**调用形态遵循 LM必读章节的 \`单参\` / \`id+body\` 总则**，本章每张表第二列只标形态，不再展开重复 schema。

## 用户与主体

| Hook | 形态 | 字段 / 说明 |
|------|------|--------------|
| saas.app.identity.userList | \`单参\` | \`{ q?, tenantId?, type? }\`；type ∈ user / user_consumer / system；返回排除 agent / official_account |
| saas.app.identity.userCreate | \`单参\` | \`{ displayName, principalType, email, password?, phone?, tenantId? }\`；事务写 principals + users，邮箱全局唯一 |
| saas.app.identity.userUpdate | \`id+body\` | body \`{ displayName?, email?, phone?, avatarUrl?, active? }\`；不改密码 |
| saas.app.identity.userDelete | \`id\`     | 软删 principals + users 两表 |
| saas.app.identity.principalList | \`单参\` | \`{ q?, type?, tenantId? }\`；type ∈ user / user_consumer / official_account / agent / system |
| saas.app.identity.principalCreate | \`单参\` | \`{ displayName, principalType, avatarUrl?, email?, phone?, tenantId? }\`；仅写 principals，不建 user/agent 关联 |
| saas.app.identity.principalUpdate | \`id+body\` | body \`{ displayName?, avatarUrl?, email?, phone?, active? }\` |
| saas.app.identity.principalDelete | \`id\` | 软删 principals；关联 membership/user/agent 不级联 |

## 组织与成员

| Hook | 形态 | 字段 / 说明 |
|------|------|--------------|
| saas.app.identity.organizationList | \`单参\` | \`{ q? }\`；q 模糊 name/code |
| saas.app.identity.organizationCreate | \`单参\` | \`{ name, code? }\` |
| saas.app.identity.organizationUpdate | \`id+body\` | body \`{ name?, code?, active? }\` |
| saas.app.identity.organizationDelete | \`id\` | 软删，旗下成员/角色不级联 |
| saas.app.identity.membershipList | \`单参\` | \`{ organizationId?, principalId?, roleId?, active? }\`；返回行附带 \`role\` (角色 code, 找不到 roleId 时回退 \`"guest"\`) 和 \`roleName\` (角色显示名, 未匹配返 null)；判断"是否真未绑定"应同时看 \`role==="guest"\` && \`roleName===null\` |
| saas.app.identity.membershipCreate | \`单参\` | \`{ organizationId, principalId, roleId?, role? }\`；roleId / role 二选一 (前者优先)；role 是角色 code (\`admin\` / \`guest\` / 自定义)；\`"owner"\` 自动映射为 \`"admin"\` |
| saas.app.identity.membershipDelete | \`id\` | 软删 + 置 active=false |

## 角色与权限

| Hook | 形态 | 字段 / 说明 |
|------|------|--------------|
| saas.app.identity.roleList | \`单参\` | \`{ q?, organizationId? }\`；q 模糊 name/code；organizationId 传 \`"null"\` 仅返回系统级角色 |
| saas.app.identity.roleCreate | \`单参\` | \`{ name, code, description?, organizationId? }\`；organizationId 不传 = 系统级 |
| saas.app.identity.roleUpdate | \`id+body\` | body \`{ name?, description? }\`；code/organizationId 不可改 |
| saas.app.identity.roleDelete | \`id\` | 软删；已分配 membership 不会清理 |
| saas.app.identity.rolePermissionList | \`id\` | 返回该角色全部 (subject, action, permissionType) 三元组 |
| saas.app.identity.rolePermissionUpsert | \`id+body\` | body \`{ items: [{ subject, action, permissionType? }] }\`；replace 语义 (旧权限被软删)；permissionType ∈ management / data / menu；受权重越权防护 |
| saas.app.identity.permissionDefinitionList | \`单参\` | \`{ permissionType?, nodeKey?, fid? }\`；fid 传 \`"null"\` 仅返回各 subject 的 root |
| saas.app.identity.permissionDefinitionCreate | \`单参\` | \`{ fid?, nodeKey, extraData?, description?, permissionType? }\`；extraData 常见键 \`weight\` / \`description\` / \`order\`；data 类节点通常由 \`@DataPermissionNode\` 装饰器启动期自动同步 |
| saas.app.identity.permissionDefinitionUpdate | \`id+body\` | body 字段同 create；改 nodeKey/fid 谨慎，会影响 RolePermission 引用 |
| saas.app.identity.permissionDefinitionDelete | \`id\` | **级联软删**节点及其全部子孙 |

## saas.app.identity.membershipList 调用范例

\`\`\`
// 全量 (未软删)
payload = [{}]

// 按组织
payload = [{ organizationId: "1" }]

// 按主体 (某用户/Agent 在所有组织的关系)
payload = [{ principalId: "<principalId>" }]

// 按角色 (该角色的所有成员)
payload = [{ roleId: "<roleId>" }]

// 组合 + 只看启用 (某用户在某组织当前生效的角色)
payload = [{ organizationId: "1", principalId: "<principalId>", active: true }]
\`\`\`

## 推荐查询流程

> ⚠ 全部 hook 名必须带 \`saas.app.identity.\` 前缀, 短名 (如 \`membershipList\`) 不是合法 hook 名。
> ⚠ 不存在 \`saas.app.identity.profile.*\` 系列 hook; 查当前/目标主体信息用 \`principalList\` / \`userList\`, 查角色关系用 \`membershipList\`。

- **找某主体的所有角色** :: 先 \`saas.app.identity.membershipList\` 传 \`[{ principalId: "<id>" }]\` 拿 membership 行 (含 \`role\` code)，再按 code 与 \`saas.app.identity.roleList\` 结果配对取中文名/描述。
- **找某 subject 下可分配的 action** :: 先 \`saas.app.identity.permissionDefinitionList\` 传 \`[{ fid: "null", nodeKey: "<subject>" }]\` 拿 subject root id，再传 \`[{ fid: "<rootId>" }]\` 拿子节点。
- **系统级 + 组织级角色并集** :: 同回合两个 tool_use 并行调 \`saas.app.identity.roleList\`，分别传 \`[{ organizationId: "null" }]\` 与 \`[{ organizationId: "<orgId>" }]\`。
- 拿到的 \`roleId\` / \`principalId\` / \`subject root id\` 等如果会被后续轮次再次用到，立即 \`saas.app.conversation.sessionData.save\` 写入 (key 例: \`entity.role.admin\` / \`entity.principal.<slug>\` / \`entity.permdef.root.<subject>\`)。
`,
};

/**
 * Saas 系统hook技能手册 — 文件管理 Hook 章节
 * @keyword-en saas-system-hook-storage-chapter
 */
export const LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_STORAGE: KnowledgeChapterInfo = {
  id: 'local_saas_system_hook_skill_storage',
  bookId: 'local_saas_system_hook_skill',
  title: '文件管理 Hook',
  sortOrder: 2,
  isLmRequired: false,
  content: `# 文件管理 Hook

storage 模块已注册的 SaaS Hook，覆盖资源库目录树、文件节点、复制、分享。**调用形态遵循 LM必读章节总则**。

## 节点管理

| Hook | 形态 | 字段 / 说明 |
|------|------|--------------|
| saas.app.storage.createNode | \`单参\` | \`{ parentPath?, name, type, resourceId?, size?, mimeType? }\`；parentPath 默认 \`"/"\`；name 不能包含 \`/\`；type ∈ folder / file；type=file 需要 resourceId (用户上传文件后由前端通过 sessionData 提供，本书无对应 hook) |
| saas.app.storage.copyNodes | \`单参\` | \`{ nodeIds: string[], targetPath: string }\`；目标目录路径如 \`"/"\` / \`"/workspace"\`；文件夹递归复制，自动重命名为 \`xxx (copy)\` |
| saas.app.storage.listNodes | \`单参\` | \`{ path?, type?, q? }\`；**只用 path 逐级访问**：根目录 \`{ path: "/" }\`，目录访问 \`{ path: "/workspace" }\`，返回该目录下一级节点；type ∈ folder / file |
| saas.app.storage.getRootNodes | \`无参\` | 兼容旧调用；新任务统一用 \`saas.app.storage.listNodes\` + \`{ path: "/" }\` |
| saas.app.storage.getNode | \`id\` | 返回节点详情 (含 share 状态) |
| saas.app.storage.updateNode | \`id+body\` | body \`{ name?, parentPath? }\`；改名或移动；parentPath=\`"/"\` 移到根；name 不能包含 \`/\` |
| saas.app.storage.deleteNode | \`id\` | 软删 (整子树) |

## 分享管理

| Hook | 形态 | 字段 / 说明 |
|------|------|--------------|
| saas.app.storage.createShare | \`id+body\` | body \`{ mode, password?, expiresIn? }\`；mode ∈ temp / permanent / password；temp 需 expiresIn (秒)；password 模式需 password |
| saas.app.storage.removeShare | \`id\` | 取消分享 (清空 share token) |

## session_data 复用提示

> ⚠ 全部 hook 名必须带 \`saas.app.storage.\` 前缀, 短名 (\`listNodes\` / \`updateNode\`) 不是合法 hook 名。

获取 nodeId / shareToken 后如果会被后续轮次复用，立即 \`saas.app.conversation.sessionData.save\` 写入：
- key 命名：\`entity.storage.<slug>\` 存 nodeId；\`entity.share.<slug>\` 存 shareToken。
- 调 \`saas.app.storage.listNodes\` 时默认从 \`{ path: "/" }\` 开始，进入子目录用节点返回的 \`path\` 字段继续查，例如 \`{ path: "/workspace" }\`；挑出用户提到的目标节点后，把 \`{ id, name, type, path }\` 写入 session_data，下一轮 \`saas.app.storage.updateNode\` / \`saas.app.storage.deleteNode\` 直接拿 id，不再二次 list。
`,
};

/**
 * Saas 系统hook技能手册 — Solution 管理 Hook 章节
 * @keyword-en saas-system-hook-solution-chapter
 */
export const LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_SOLUTION: KnowledgeChapterInfo = {
  id: 'local_saas_system_hook_skill_solution',
  bookId: 'local_saas_system_hook_skill',
  title: 'Solution 管理 Hook',
  sortOrder: 3,
  isLmRequired: false,
  content: `# Solution 管理 Hook

solution 模块的 SaaS Hook。**调用形态遵循 LM必读章节总则**。注意 list 是**跨所有 mounted Runner 并行聚合**，不是单库查询。

## Solution 管理

| Hook | 形态 | 字段 / 说明 |
|------|------|--------------|
| saas.app.solution.list | \`单参\` | \`{ page?, pageSize?, tag?, q?, isInstalled?, isPublished?, source?, runnerId? }\`；不传 runnerId = 跨全部 Runner 聚合 |
| saas.app.solution.get | \`id\` | 详情；id 可由 list 拿到 |
| saas.app.solution.create | \`单参\` | \`{ runnerIds?, name, version, summary?, description?, iconUrl?, tags?, authorName?, markdownContent?, pluginDir?, isPublished?, source?, location?, images?, includes? }\` |
| saas.app.solution.update | \`id+body\` | body \`{ summary?, description?, iconUrl?, tags?, markdownContent?, status?, isPublished?, source?, location?, images?, includes? }\`；不可改 name / version |
| saas.app.solution.delete | \`id\` | 删除 Solution 记录 (不会自动卸载已部署 Runner) |

## 安装与运行

| Hook | 形态 | 字段 / 说明 |
|------|------|--------------|
| saas.app.solution.install | \`id+body\` | body \`{ runnerIds: string[] }\` (≥1 项)；安装该 solution 到指定 Runner；需要 \`install\` ability |
| saas.app.solution.uninstall | \`id+body\` | body 同 install；需要 \`uninstall\` ability |
| saas.app.solution.getRunners | \`无参\` | \`[]\`；列出可用 Runner (含 alias / online 状态)，前置查询 install 目标 |
| saas.app.solution.getTags | \`无参\` | \`[]\`；从聚合 Solution 列表统计 tag 频次榜 |

## ⚠️ 占位 Hook (固定返回空)

| Hook | 状态 |
|------|------|
| saas.app.solution.marketplaceList | 市场未上线，返回空数组 |
| saas.app.solution.purchasesList   | 购买记录未上线，返回空数组 |
| saas.app.solution.purchase        | 仅本地写记录，无真实结算 |

如果用户问"市场上有什么 Solution / 我买了什么"，**告诉用户该能力暂未上线**，不要消耗 token 调上述 hook。

## 枚举值

- \`source\` :: \`self_developed\` / \`marketplace\`
- \`status\` (PluginStatus) :: \`active\` / \`inactive\`
- \`includes\` :: 数组，元素 ∈ \`app\` / \`unit\` / \`workflow\` / \`agent\`

## 推荐流程

> ⚠ 全部 hook 名必须带 \`saas.app.solution.\` 前缀, 短名 (\`list\` / \`install\` / \`getRunners\`) 不是合法 hook 名。

1. **查找可装的 Solution + 目标 Runner** :: 同回合并行调 \`saas.app.solution.list\` (\`[{ q }]\`) + \`saas.app.solution.getRunners\` (\`[]\`)，拿到 (solutionId, runnerIds[])。
2. **安装** :: 调 \`saas.app.solution.install\`，\`id+body\` 形态: \`["<solutionId>", { runnerIds: [...] }]\`。
3. **session_data 落地** :: 把 (solutionId, name, version) 与 (runnerId, alias) 写到 session_data，便于后续 \`saas.app.solution.update\` / \`saas.app.solution.uninstall\` 直接复用。
`,
};

/**
 * Saas 系统hook技能手册 — 待办任务 Hook 章节
 * @keyword-en saas-system-hook-todo-chapter
 */
export const LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_TODO: KnowledgeChapterInfo = {
  id: 'local_saas_system_hook_skill_todo',
  bookId: 'local_saas_system_hook_skill',
  title: '待办任务 Hook',
  sortOrder: 4,
  isLmRequired: false,
  content: `# 待办任务 Hook

todo 模块已注册的 SaaS Hook，覆盖待办查询、详情、创建、更新、删除、跟进记录与评论。**调用形态遵循 LM必读章节总则**。

## Hook 列表

| Hook | 形态 | 字段 / 说明 |
|------|------|--------------|
| saas.app.todo.list | \`单参\` | \`{ status?, followerId?, initiatorId?, q? }\`；不指定 initiatorId/followerId 时服务层按当前 principalId 过滤 |
| saas.app.todo.get | \`id\` | 详情 |
| saas.app.todo.create | \`单参\` | \`{ initiatorId, title, description?, content?, followerIds?, statusColor?, status? }\`；initiatorId **必须等于**当前登录 principalId |
| saas.app.todo.update | \`id+body\` | body \`{ title?, description?, content?, followerIds?, statusColor?, status? }\` |
| saas.app.todo.delete | \`id\` | 软删 |

## 跟进记录 Hook

| Hook | 形态 | 字段 / 说明 |
|------|------|--------------|
| saas.app.todo.followup.create | \`id+body\` | id = todoId；body \`{ followerId, followerName, followerAvatar?, status, content? }\` |
| saas.app.todo.followup.list | \`id\` | id = todoId；按 createdAt 升序返回跟进记录 |
| saas.app.todo.followup.update | \`id+body\` | id = followupId；body \`{ followerId?, followerName?, followerAvatar?, status?, content? }\` |
| saas.app.todo.followup.delete | \`id\` | id = followupId；物理删除跟进记录 |

## 评论 Hook

| Hook | 形态 | 字段 / 说明 |
|------|------|--------------|
| saas.app.todo.comment.create | \`id+body\` | id = followupId；body \`{ userId, userName, userAvatar?, content }\` |
| saas.app.todo.comment.list | \`id\` | id = followupId；按 createdAt 升序返回评论 |
| saas.app.todo.comment.delete | \`id\` | id = commentId；物理删除评论 |

## 状态枚举 (\`status\`)

- \`pending\` :: 未开始
- \`in_progress\` :: 进行中
- \`failed\` :: 失败
- \`waiting_acceptance\` :: 等待验收
- \`completed\` :: 已完成

## 数据权限约束 (来自 \`@DataPermissionNode\`)

- **create** :: \`initiatorId\` 必须 = 当前登录 principalId，否则 forbidden。
- **list** :: 指定 \`initiatorId\` / \`followerId\` 时也必须 = 当前 principalId；都不指定 → 默认按当前用户范围查。
- **update / delete** :: 服务层按当前用户权限过滤；越权访问会软错。

## session_data 复用提示

> ⚠ 全部 hook 名必须带 \`saas.app.todo.\` 前缀, 短名 (\`list\` / \`create\` / \`update\`) 不是合法 hook 名。

- 用户在多轮里追踪同一批 todo (查、改状态、补 description) → 把 \`{ todoIds: [...] }\` 写入 \`progress.todo.<topic>\`，避免每轮重新调 \`saas.app.todo.list\`。
- 用户在多轮里追踪某个 todo 的跟进记录/评论 → 把 \`todoId\`、\`followupId\` 写入 \`progress.todo.<topic>\` 或 \`entity.todo.<slug>\`，后续直接调 \`saas.app.todo.followup.*\` / \`saas.app.todo.comment.*\`。
- 当前用户的 principalId 推荐写入 \`entity.principal.self\`，\`saas.app.todo.create\` / \`saas.app.todo.list\` 校验时直接复用。
`,
};

/**
 * Saas 系统hook技能手册 — 时间数据操作 Hook 章节
 * @keyword-en saas-system-hook-time-zone-chapter
 */
export const LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_TIME_ZONE: KnowledgeChapterInfo = {
  id: 'local_saas_system_hook_skill_time_zone',
  bookId: 'local_saas_system_hook_skill',
  title: '时间数据操作 Hook',
  sortOrder: 5,
  isLmRequired: false,
  content: `# 时间数据操作 Hook

> **凡是处理"今天" / "明天上午" / "下周二" / "X 月 X 日"这类用户视角的时间表达, 或者要把数据库 UTC 时间显示给用户, 都必须先调本章节的 hook 转换, 不要假设服务器时区**。

本章覆盖 \`saas.app.timeZone.*\` 系列 hook (toUtc / fromUtc / now / lookupByIp), **payload 统一是数组形参: 单参传 \`[{ ...字段 }]\`**。

## 设计原则

- **服务端时间统一 UTC** :: SaaS / Runner 数据库存的、内部消息传递的、kernel \`Date.now()\` 给出的都是 UTC. Runner Docker 镜像固定 \`TZ=UTC\`
- **本地时间是用户视角的临时计算结果** :: 不存库, 仅在 "用户输入解析" 和 "对用户展示" 这两个边界做转换
- **不要写 \`new Date(...).toISOString()\` 假设服务器时区** :: 服务器时区可能是 UTC (Runner) 也可能是 SaaS 部署所在地, 不可靠; 永远显式调本章节 hook

## Hook 列表

### saas.app.timeZone.toUtc — 本地 → UTC

\`\`\`
call_hook(
  hookName = "saas.app.timeZone.toUtc",
  payload  = [{
    localTime:     string,  // 本地时间 ISO 8601 (e.g. "2026-05-16 09:00:00" / "2026-05-16T09:00:00")
    fromTimezone:  string   // IANA 时区名 (e.g. "Asia/Shanghai", "America/New_York", "Europe/London")
  }]
)
→ { utc: "2026-05-16T01:00:00.000Z" }
\`\`\`

**典型场景**:
- 用户说 "明天早上 9 点" → 你解析出"明天" 9:00 (在用户时区下) → 调本 hook 转 UTC → 存数据库 / 创 todo dueDate
- 用户填表选了"2026-05-16 09:00" → 调本 hook 转 UTC

### saas.app.timeZone.fromUtc — UTC → 用户时区本地视图

\`\`\`
call_hook(
  hookName = "saas.app.timeZone.fromUtc",
  payload  = [{
    utcTime:     string,  // UTC ISO (e.g. "2026-05-16T01:00:00Z")
    toTimezone:  string   // IANA 时区名
  }]
)
→ {
    iso:           "2026-05-16T09:00:00+08:00",  // 带偏移的本地 ISO
    year:          2026,
    month:         5,
    day:           16,
    hour:          9,
    minute:        0,
    second:        0,
    offsetMinutes: 480,                          // 东八区 = +480 分钟
    timezone:      "Asia/Shanghai"
  }
\`\`\`

**典型场景**:
- 数据库里 todo.dueDate 是 UTC, 给用户展示 → 调本 hook 拿 iso + 分量字段渲染
- 算 "用户本地的今天是几月几号" → 用返回值 .year/.month/.day 直接拿

### saas.app.timeZone.now — 当前时间

\`\`\`
call_hook(
  hookName = "saas.app.timeZone.now",
  payload  = [{ timezone?: string }]   // 不传只回 UTC
)
→ { utc: "2026-05-16T01:00:00.000Z", local?: { iso, year, ..., offsetMinutes, timezone } }
\`\`\`

**替代用法**: agent 内部计算时间永远用本 hook, **不要**写 \`new Date()\` 假设服务器时区。

### saas.app.timeZone.lookupByIp — IP 定位时区

\`\`\`
call_hook(
  hookName = "saas.app.timeZone.lookupByIp",
  payload  = [{ ip: string }]   // IPv4 / IPv6
)
→ { timezone: "Asia/Shanghai", country: "CN", region: null, source: "stub-utc-fallback" }
\`\`\`

⚠️ **当前实现是 stub**: 固定返回 \`{ timezone: "UTC", source: "stub-utc-fallback" }\`. 后续会接 GeoIP, hook 接口不变。**调用方应能容忍 UTC fallback** (用户没设置时区时退化展示 UTC, 不致命)。

## 典型完整流程

### A. 用户说"提醒我明天早上 9 点"

\`\`\`
# step 1: 拿用户时区 (从 session_data / 用户档案 / IP)
session_data.entity.user.timezone  →  "Asia/Shanghai"  (优先, 已存就用)
否则 → saas.app.timeZone.lookupByIp({ ip: <用户 IP> }) → { timezone }

# step 2: 在用户时区下算出"明天早上 9 点"的本地时间字符串
今天本地 → saas.app.timeZone.now({ timezone: "Asia/Shanghai" }) → local.year/month/day
明天本地 = year, month, day+1 (注意月底 / 闰年, 用 Date 算)
localTime = "2026-05-17 09:00:00"

# step 3: 转 UTC 存
saas.app.timeZone.toUtc({ localTime, fromTimezone: "Asia/Shanghai" }) → "2026-05-17T01:00:00.000Z"

# step 4: 用此 UTC 调 saas.app.todo.create({ ..., dueDate: <utc> })
\`\`\`

### B. 给用户展示数据库里的时间

\`\`\`
todo 列表查回来, dueDate = "2026-05-17T01:00:00.000Z" (UTC)

# 显示给用户前调:
saas.app.timeZone.fromUtc({ utcTime: dueDate, toTimezone: "<user 的 tz>" })
→ iso = "2026-05-17T09:00:00+08:00"
→ 渲染给用户: "明天 9:00 (你的时区)" 或类似
\`\`\`

## 关键约定

- **IANA 时区名** :: 必须用 \`Continent/City\` 形式, 不能用 \`CST\` / \`GMT+8\` 这种缩写 (歧义大). 中国大陆 = \`Asia/Shanghai\`, 香港 = \`Asia/Hong_Kong\`, 美东 = \`America/New_York\`, 美西 = \`America/Los_Angeles\`, 英国 = \`Europe/London\`, 日本 = \`Asia/Tokyo\`.
- **localTime 字符串不含时区** :: \`fromTimezone\` 参数告诉框架"这个时间在哪个时区下"; 如果 localTime 已含 \`Z\` 或 \`+08:00\` 也能解析, 但语义模糊建议不传冲突的
- **用户时区从哪拿** :: 优先级 \`session_data.entity.user.timezone\` > 用户档案 (saas.app.identity.* 待支持) > \`lookupByIp\`; 都没有就用 \`UTC\` 兜底
- **不要二次转换** :: UTC → A 时区 → 再转回 UTC 通常意味着你逻辑写错了; 一次到位
- **没有夏令时坑** :: \`Intl.DateTimeFormat\` 自动处理夏令时, 你不用关心

## session_data 复用

- 首次拿到用户时区后 → 立刻 \`saas.app.conversation.sessionData.save({ sessionId, key: "entity.user.timezone", value: "<tz>" })\`
- 下轮 \`[session data]\` 自动注入, 不用再调 \`lookupByIp\`

## Runner 数据触点的特别说明

Runner 内部时间统一 UTC, runner docker 镜像 \`TZ=UTC\`. **数据触点胶水代码处理"用户本地时间"时**:
1. 拿触发用户的时区 (通常通过 payload 传入或从 SaaS 查) → 调 \`saas.app.timeZone.fromUtc\` 转用户时区视图
2. 比较 / 判定逻辑用本地分量 (e.g. local.hour === 9 判断"早上 9 点")
3. 写消息内容时显式说明 "(你的时区: XXX)" 避免用户疑惑

详见 Runner Hook 专用手册的 "数据触点 (Data Touchpoint)" 章节 (bookId=\`local_runner_hook_skill\`).
`,
};

/**
 * Runner Hook 专用手册 — LM必读章节
 * @keyword-en runner-hook-lm-required-chapter
 */
export const LOCAL_CHAPTER_RUNNER_HOOK_LM: KnowledgeChapterInfo = {
  id: 'local_runner_hook_skill_lm',
  bookId: 'local_runner_hook_skill',
  title: 'LM必读',
  sortOrder: 0,
  isLmRequired: true,
  content: `# Runner Hook 专用手册 — LM必读

调用 Runner 侧 hook 必须用 \`call_hook(target="runner", runnerId="<rid>", hookName="runner.app.*", payload=...)\`. **runnerId 必填**, 走 \`search_hook(target="runner", runnerId="<rid>")\` / \`get_hook_info(target="runner", runnerId="<rid>", hookNames=[...])\` 拿现成的 hook 列表 + payload schema。

## ⚠ Runner 时区固定 UTC (硬约束)

> **Runner Docker 镜像 \`TZ=UTC\` 永久写死**, Runner 内部所有时间 (kernel \`Date.now()\` / mongo 默认时间 / 触点元数据 createdAt / 运行历史 startedAt / 胶水代码 \`new Date()\`) **统一 UTC**, 跟外部物理时区无关。

设计目的:
- **跨地域 runner 部署一致** :: 同一 solution 部署到香港 / 东京 / 伦敦 Runner, 内部时间观完全一致, 数据可跨 runner 比对
- **数据触点链表的时间稳定** :: \`data_touchpoint_runs\` 链表按 \`startedAt\` 排序; UTC 保证不会因为 daylight-saving / 时区迁移导致顺序错乱
- **跟用户视角隔离** :: 用户的"今天" / "早上 9 点"是其本地时区下的概念, 跟 Runner 内部时间观无关; 业务需要本地视图时显式调时区转换 hook

这意味着 Runner 端胶水代码 / agent 内部:
- ❌ **禁止假设** \`new Date().toISOString()\` 输出"当地时间", 它就是 UTC
- ❌ **禁止假设** mongo 查到的 createdAt 是"用户本地时间", 它就是 UTC
- ✅ **必须显式调** \`saas.app.timeZone.*\` (见 SaaS 系统Hook技能手册的 "时间数据操作 Hook" 章节) 转换到用户时区

## Runner 端常用 hook 入口

Runner 提供的 hook 都以 \`runner.\` 开头, 分两大类:

| 前缀 | 含义 | 示例 |
|------|------|------|
| \`runner.app.*\` | Runner 应用层 (Solution / 数据触点 / 配置等) | runner.app.dataTouchpoint.list |
| \`runner.unitcore.*\` | Runner Unit Core 基座能力 (file / mongo / ast 等系统能力原语) | runner.unitcore.mongo.aggregate |
| \`runner.system.*\` | Runner 自身元 hook (hookbus 查询等) | runner.system.hookbus.getInfo |

**强约束**: 不要凭名字猜 payload, 第一次调某 hook 前必须 \`get_hook_info(target="runner", runnerId="<rid>", hookNames=[...])\` 拿 schema。

## 章节目录

| 章节名称 | chapterId | 适用场景 |
|----------|-----------|----------|
| 数据触点 (Data Touchpoint) | local_runner_hook_skill_data_touchpoint | 创建/管理/查询长期数据监测点, 配合胶水代码做定时检查 + 主动通知 |

## 调用形态 (跟 SaaS 系统 Hook 不同)

Runner 端的 hook 用法跟 SaaS 端 \`@HookController/@HookRoute\` 直接注册的形态一致:

\`\`\`
payload 必须是数组: 单参 \`[{ ...字段 }]\`, 多参 \`[arg1, arg2]\`
\`\`\`

例:
\`\`\`json
// ✅ 正确
{ "hookName": "runner.app.dataTouchpoint.list", "target": "runner", "runnerId": "rid-x", "payload": [{ "enabled": true }] }

// ❌ 错误 (旧 envelope/input/args 风格)
{ "payload": { "input": { "enabled": true }, "args": [...] } }
\`\`\`

## 权限与失败处理

- Runner hook 的 \`@CheckAbility\` 实际**在 SaaS 端鉴权** (跨进程 envelope 携带 principal 信息), runner 端不重复校验
- 越权时 errorMsg 含 \`permission/ability/forbidden\`; 看到立即停止重试, 不要换 runnerId 绕权
- \`runnerId\` 错 / runner 离线时 errorMsg 含 \`runner-not-found\` / \`socket-disconnected\`; 这种情况是基础设施问题, 提示用户而非重试
`,
};

/**
 * Runner Hook 专用手册 — 数据触点 (Data Touchpoint) 章节
 * @keyword-en runner-hook-data-touchpoint-chapter
 */
export const LOCAL_CHAPTER_RUNNER_HOOK_DATA_TOUCHPOINT: KnowledgeChapterInfo = {
  id: 'local_runner_hook_skill_data_touchpoint',
  bookId: 'local_runner_hook_skill',
  title: '数据触点 (Data Touchpoint)',
  sortOrder: 1,
  isLmRequired: false,
  content: `# 数据触点 (Data Touchpoint) — Runner 长期数据探针

数据触点是"用户视角的数据探针": 用户对某个数据维度持续关注 (如 "近 7 天订单是否下降 30%"), 你创建一个触点 + 一份胶水代码, 系统在业务事件 / 定时调度下跑胶水, 胶水自决要不要给用户发通知。

## 心智模型

| 概念 | 含义 |
|------|------|
| 触点 (Touchpoint) | 元数据 + 一份 JS 胶水代码; 长期存在直到 delete |
| 胶水代码 | \`touchpoints/<id>/index.js\`, default export 一个 async 函数; 内可调 \`ctx.callHook\` / 用 \`ctx.ret\` 返回结果 |
| 触发 (trigger) | 两种: ① 业务事件 (\`sources\` 命中) ② 定时 (\`schedule\` 声明) |
| 通知派发 | 胶水 \`return ctx.ret.success({ notify })\` 后, 框架按 \`notifyTargets\` 中间表自动发 sendMsg, 每个 session 合并 mention 全部 agent |
| 运行历史 | \`data_touchpoint_runs\` 链表 (单向链, previousRunId 指上一条), 30 天 TTL; 每次执行无论成败都进链 (skip 默认不进) |
| 错误码 | \`HANDLER_THROW / HOOK_DENIED / TIMEOUT / LOAD_FAILED / NOTIFY_TARGET_INVALID / INTERNAL_ERROR\` |

## ⚠ Runner UTC 时区约定下的胶水代码

> **Runner 内部所有时间字段都是 UTC** (见 LM必读章节). 胶水代码处理 "用户视角的本地时间" 时**必须**显式调 \`saas.app.timeZone.*\`, 不能假设 \`new Date()\` 输出当地时间。

### 反例 (不会按预期工作)

\`\`\`js
export default async function ({ callHook, log, touchpoint, ret }) {
  const now = new Date();
  // ❌ 错: now 永远是 UTC, runner 即便部署在中国, getHours() 也是 UTC 小时数
  if (now.getHours() < 9) {
    return ret.skip({ reason: '太早了不通知' });
  }
  // ...
}
\`\`\`

### 正例 — 获取用户时区后转换

\`\`\`js
// touchpoints/<id>/index.js
export const schedule = { cron: '0 * * * *' };  // 每小时跑一次

export default async function ({ callHook, log, touchpoint, payload, ret }) {
  // 1. 拿触发的用户时区
  // 优先级: payload 携带 > 触点元数据 (后续可扩展) > IP 查询 > UTC fallback
  const userTimezone = payload?.userTimezone
    ?? (await callHook('saas.app.timeZone.lookupByIp', { ip: payload?.userIp ?? '0.0.0.0' })).timezone
    ?? 'UTC';

  // 2. 拿当前 UTC + 用户时区下的本地视图
  const nowResult = await callHook('saas.app.timeZone.now', { timezone: userTimezone });
  // nowResult = { utc: "2026-05-16T01:00:00.000Z", local: { year, month, day, hour: 9, ... } }

  // 3. 用户本地时间做判定 (e.g. 早上 9 点之前不通知)
  if (nowResult.local.hour < 9 || nowResult.local.hour >= 22) {
    return ret.skip({ reason: \`用户本地时间 \${nowResult.local.hour}:00, 不在通知时段\` });
  }

  // 4. 业务计算 (查 mongo / aggregate 等), 跟时间无关的字段不需要再转
  const stats = await callHook('runner.unitcore.mongo.aggregate', {...});
  if (stats.dropPct < 0.3) return ret.skip({ reason: '降幅未达阈值' });

  // 5. 通知内容里显式带本地时间 (避免用户疑惑)
  return ret.success({
    notify: {
      content: \`[\${touchpoint.name}] \${nowResult.local.year}-\${String(nowResult.local.month).padStart(2,'0')}-\${String(nowResult.local.day).padStart(2,'0')} \${String(nowResult.local.hour).padStart(2,'0')}:00 检测到订单降幅 \${(stats.dropPct*100).toFixed(1)}%\`
    },
    state: { lastFiredAt: nowResult.utc, lastValue: stats.value },
  });
}
\`\`\`

### state 字段也用 UTC

胶水代码 \`return ret.success({ state: {...} })\` 写入 \`prevState\` 时, 时间字段一律存 UTC (跟 Runner 内部一致). 下次执行 \`prevState\` 拿出来要比较时, 拿 UTC 比较, 比好之后再转用户本地展示。

## 创建/管理触点的 hook

详见 \`get_hook_info\` 拿现成 schema. 常用 4 个:

| Hook | 用途 | 鉴权 (LLM 链路) |
|------|------|------|
| runner.app.dataTouchpoint.create | 创建触点 | createdByAgentId 自动注入当前 principalId, 不要传 |
| runner.app.dataTouchpoint.update | 更新触点 | 只能改自己创建的触点 |
| runner.app.dataTouchpoint.delete | 删除触点 (含 state / 运行历史 / schedule 联动清理) | 只能删自己创建的 |
| runner.app.dataTouchpoint.list | 列出触点 | LLM 链路强制限定 "我创建的 + 通知到我的" |

\`runner.app.dataTouchpoint.trigger\` LLM 调用会被拒 (防伪造业务事件), 仅业务模块 / 系统调用方可用。

## 通知派发的中间表设计

触点元数据 \`notifyTargets: Array<{ sessionId, agentIds[] }>\` 是中间表:
- 一个 session 一个 entry, entry.agentIds 是该 session 内要 @ 的 agent 子集
- agent 必须是该 session 实际成员 (创建时责任在调用方; 运行时 saas 端严格校验, 不是成员就 NOTIFY_TARGET_INVALID)
- 不要写笛卡尔积形态 \`{ sessionIds[], agentIds[] }\`, 因为不同 session 关注的 agent 通常不一样

例 (agent-A 在 s1/s2 都在, agent-B 只在 s1):
\`\`\`json
{
  "notifyTargets": [
    { "sessionId": "s1", "agentIds": ["agent-A", "agent-B"] },
    { "sessionId": "s2", "agentIds": ["agent-A"] }
  ]
}
\`\`\`
派发结果: s1 一条消息 @[A,B]; s2 一条消息 @[A]

## 胶水代码 ctx 全貌

\`\`\`ts
export default async function (ctx: {
  payload:           unknown,                // 业务事件 trigger 传入 / schedule 触发时为 { firedBy, firedAt }
  matchedSources:    string[],               // 触发的 source 列表交集 (schedule 为 [])
  payloadsBySource:  Record<string, unknown>,// 按 source 切片的 payload
  prevState:         unknown,                // 上次执行 return 的 state (首次为 undefined; 高频触点用 redis 会 TTL 过期成 undefined)
  callHook:          (name, payload) => Promise<unknown>,  // 受限 callHook (白名单 + 通知 hook 硬黑名单)
  log:               (msg, attrs?) => void,                // 写到 runLog.log[]
  ret:               TouchpointRet,                        // 统一返回器
  touchpoint:        {                                     // 触点元数据快照 (只读, 字段裁剪)
    _id, name, notifyTargets, createdByAgentId, solutionId, sources
  },
}): unknown
\`\`\`

\`ret\` 是统一返回器:
- \`ret.skip({ record?, reason? })\` :: 跳过, state 保留, record=true 才写 runLog (默认不写, 高频静默检查不刷库)
- \`ret.success({ state?, notify? })\` :: 业务跑通, state 落库 + notify 触发框架按 notifyTargets 派发
- \`ret.error({ message, code? })\` :: 主动报错 (通常 \`throw\` 就够了, 框架自动捕获等价 \`ret.error\`)

## 沙箱限制

胶水代码 \`callHook\` 受两道门保护:
1. **\`config.allowedHooks\` 白名单** (touchpoint.config.json 里列): 不在白名单的 hook 拒
2. **\`SANDBOX_NOTIFY_DENYLIST\` 硬黑名单**: \`saas.app.conversation.sendMsg\` 等通知 hook 即便列在 allowedHooks 也拒. 通知唯一路径是 \`ret.success({ notify })\`

\`config.timeout\` 上限 60s, 超时会被 \`worker.terminate()\` **强 kill**, 胶水 finally 不会跑, 副作用要做幂等。

## schedule 定时触发

胶水代码可选 export:
\`\`\`js
// 三选一
export const schedule = { cron: '0 9 * * *', timezone: 'Asia/Shanghai' };  // cron 字符串 + 可选 timezone (默认 UTC)
export const schedule = { interval: 60_000 };                              // 每 60 秒一次, 最小 1000ms
export const schedule = { once: '2026-06-01T09:00:00+08:00' };             // 一次性 ISO (含时区偏移)
\`\`\`

⚠ **优先用 source-driven (业务事件 trigger)**, schedule 是补充手段 (适用于"无业务事件可订阅"的累积指标 / 外部 API 巡检). 不要无脑加 \`schedule: { interval: 5000 }\` 让 collection 被刷爆 (高频静默检查用 \`ret.skip()\` 不进 runLog 即可)。

## 错误诊断

run 失败时:
1. 调 \`runner.app.dataTouchpoint.list\` 拿触点 (\`get_hook_info\` 看 schema)
2. 通过 mongo \`data_touchpoint_runs\` (走 \`runner.unitcore.mongo.find\` hook) 拉运行历史, 按 \`previousRunId\` 反向追溯链
3. 看 \`error.code\` 快速分类:
   - \`NOTIFY_TARGET_INVALID\` :: error.message 含 \`principalId=<x> sessionId=<y>\` → 修复 notifyTargets 中间表 (移除该错配)
   - \`HOOK_DENIED\` :: 胶水代码调了白名单外 hook → 更新 touchpoint.config.json
   - \`TIMEOUT\` :: 胶水跑超 60s → 优化算法 or 拆触点
   - \`HANDLER_THROW\` :: error.stack 看具体抛错位置
4. 跨进程 trace :: runLog 含 traceId, 关联的 saas sendMsg span 通过 \`hook.upstreamTraceId\` attribute 反查

## session_data 复用

- 触点创建后 → \`saas.app.conversation.sessionData.save({ key: "progress.touchpoint.<topic>", value: { id, name } })\`, 下轮上下文能直接拿 id 不用再 list
- 用户时区 → \`saas.app.conversation.sessionData.save({ key: "entity.user.timezone", value: "<tz>" })\`, 数据触点胶水代码可通过 payload 透传给胶水

详见 SaaS 系统Hook技能手册的 "时间数据操作 Hook" 章节 (bookId=\`local_saas_system_hook_skill\`, chapterId=\`local_saas_system_hook_skill_time_zone\`).
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
  LOCAL_BOOK_SAAS_SYSTEM_HOOK,
  LOCAL_BOOK_RUNNER_HOOK,
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
  [
    'local_saas_system_hook_skill',
    [
      LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_LM,
      LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_IDENTITY,
      LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_STORAGE,
      LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_SOLUTION,
      LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_TODO,
      LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_TIME_ZONE,
    ],
  ],
  [
    'local_runner_hook_skill',
    [
      LOCAL_CHAPTER_RUNNER_HOOK_LM,
      LOCAL_CHAPTER_RUNNER_HOOK_DATA_TOUCHPOINT,
    ],
  ],
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
      LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_LM,
      LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_IDENTITY,
      LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_STORAGE,
      LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_SOLUTION,
      LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_TODO,
      LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_TIME_ZONE,
      LOCAL_CHAPTER_RUNNER_HOOK_LM,
      LOCAL_CHAPTER_RUNNER_HOOK_DATA_TOUCHPOINT,
    ].map((c) => [c.id, c]),
  );

/**
 * 判断一个 ID 是否属于本地知识（前缀 `local_`）
 * @keyword-en is-local-knowledge-id
 */
export function isLocalKnowledgeId(id: string): boolean {
  return id.startsWith('local_');
}
