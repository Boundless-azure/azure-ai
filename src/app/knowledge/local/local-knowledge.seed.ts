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
 * 系统手册
 * @keyword-en system-manual-book
 */
export const LOCAL_BOOK_SAAS_SYSTEM_HOOK: KnowledgeBookInfo = {
  id: 'local_saas_system_hook_skill',
  type: KnowledgeBookType.SKILL,
  name: '系统手册',
  description:
    '系统内置手册，覆盖术语说明、鉴权管理、文件管理、解决方案、待办实现、时间数据和数据触点查询说明。',
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
    '数据触点',
  ],
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
};

/**
 * Runner 手册 (Runner 端调用约定 / Unit Core 基座 / Identity & Ability / Solution / 数据触点 总览)
 * 手册 bookId 保持 `local_runner_hook_skill` 不动 (兼容 sessionData 历史引用 + knowledge.search 关键词索引)。
 * @keyword-en runner-handbook
 */
export const LOCAL_BOOK_RUNNER_HOOK: KnowledgeBookInfo = {
  id: 'local_runner_hook_skill',
  type: KnowledgeBookType.SKILL,
  name: 'Runner 手册',
  description:
    'Runner 端完整使用手册: 调用约定 (UUID runnerId + 4 段 hookName + array payload)、Unit Core 基座能力 (mongo/terminal/file/ast)、Identity & Ability 本地 RBAC + 数据权限、Solution / 数据触点业务 hook、Runner 时区 UTC 硬约束。' +
    ' LLM 用 target=runner 任何 hook 前先读本书。',
  creatorId: null,
  isEmbedded: false,
  active: true,
  tags: [
    '本地知识',
    'Runner',
    'Hook',
    'Unit Core',
    'mongo',
    'terminal',
    'file',
    'ability',
    '数据触点',
    'Solution',
    '时区',
  ],
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
};

/**
 * Code Agent 开发手册
 * @keyword-en code-agent-development-handbook-book
 */
export const LOCAL_BOOK_CODE_AGENT_DEVELOPMENT: KnowledgeBookInfo = {
  id: 'local_code_agent_development_handbook',
  type: KnowledgeBookType.SKILL,
  name: 'Code Agent 开发手册',
  description:
    'code-agent 专用开发前置手册，说明 Solution/App/Unit 的 Runner 数据库检索方法、轻量 view solution、应用开发前工作、npx 模板查询约定和 Unit 开发前工作。',
  creatorId: null,
  isEmbedded: false,
  active: true,
  tags: [
    '本地知识',
    'CodeAgent',
    '开发工作流',
    'Solution',
    'App',
    'Unit',
    '模板',
    'Runner数据库',
    '目标选择',
    '终端指令',
  ],
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
> 本会话历史已被切成若干 \`smart\` 段 (按配置阈值分段, 默认约 5000 字可见正文一段, 每段有 keywords + summary)。
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
      summary:        string,          // 分段摘要, 用它决定要不要展开
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

> 用法: 通读 summary, 选 1-3 个真正相关的 smartId 进入 ③。单段按配置阈值生成 (默认约 5000 字可见正文), 别贪多。

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
 * 系统手册 — LM必读章节
 * @keyword-en system-manual-lm-required-chapter
 */
export const LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_LM: KnowledgeChapterInfo = {
  id: 'local_saas_system_hook_skill_lm',
  bookId: 'local_saas_system_hook_skill',
  title: 'LM必读',
  sortOrder: 0,
  isLmRequired: true,
  content: `# 系统手册 — LM必读

本书是系统能力导航。**LM必读只讲概念和该读哪个章节, 不在这里展开 hook name / payload**。

做系统管理类任务时, 不要凭名字猜能力, 先判断用户意图属于哪个业务概念, 再读取对应章节拿完整调用细节。

## 章节目录

| 章节名称 | 适用场景 |
|----------|----------|
| 术语大全 | 系统概念、同义词、边界不确定时先读 |
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

数据触点不是 SaaS 侧通用管理 hook, 它主要属于 Runner 端能力。只要用户提到"持续监控"、"达到条件提醒我"、"每天检查数据"、"数据异常主动通知", 必须转去读 **Runner 手册** 的 **数据触点 (Data Touchpoint)** 章节。

## Runner 操作手册指向

Runner 必然存在一些基座支持的 hook, 例如数据触点、Runner 应用层能力、Unit Core 文件/Mongo/AST 等系统能力原语。这些不是系统手册的 SaaS 章节负责展开的内容。

当任务需要操作 Runner、创建数据触点、读取 Runner 本地能力、执行 Solution 运行时动作时:

1. 先读 **Runner 手册** (bookId=\`local_runner_hook_skill\`) 的 **LM必读** 章节。
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

## Web Component Hook — 优先使用 markdown fence 渲染

系统内预置了一批 **Web Component Hook**。这类 hook 不通过 \`call_hook\` 调用，而是由你在回复里输出一段特殊 markdown fence，前端识别后自动拉取并渲染对应的交互组件，组件内部会自己调用接口获取数据。

### 何时优先使用 Web Component Hook

当用户想"展示"、"查看"或"分析"某类数据时（而不是修改数据），优先检查是否有匹配的 Web Component Hook，而不是用 \`call_hook\` 查数据再自己拼文字输出：

| 场景 | 不推荐 | 推荐 |
|------|--------|------|
| 展示待办列表 | call saas.app.todo.list → 输出 markdown 表格 | 输出 hook fence，组件自动渲染 |
| 展示文件目录 | call file.list → 输出树状文字 | 输出 hook fence，组件自动渲染 |
| 数据可视化图表 | 手工构造数据描述 | 输出 hook fence，图表组件内部取数渲染 |

**原则**：只要有匹配的 Web Component Hook，它的展示效果和实时性都远优于文字输出，且不消耗你的调用次数。

### 如何发现可用的 Web Component Hook

调用 Runner 端的 hookbus 搜索，过滤 \`isComponent=true\` 或 tag \`component\`：

\`\`\`
call_hook("runner.system.hookbus.search", [{ tag: "component" }])
\`\`\`

返回的每个 hook 包含 \`name\`、\`description\`、\`tags\` 和 \`payloadSchema\`（告知该传什么 payload）。

### 输出格式

发现匹配的 Web Component Hook 后，在回复里输出 markdown fence（不要加其他说明）：

\`\`\`
\`\`\`hook
{"actionHook":"<hookName>","payload":{...根据 payloadSchema 填写}}
\`\`\`
\`\`\`

例如展示某用户的待办列表：

\`\`\`
\`\`\`hook
{"actionHook":"runner.app.todo.card","payload":{"assigneeId":"u-123","status":"open"}}
\`\`\`
\`\`\`

**payload** 通常是筛选条件（assignee、status、dateRange 等），组件会用它来查询并渲染。\`payloadSchema\` 告诉你该传哪些字段。

### 注意事项

- Web Component Hook 的 \`denyLlm=true\`：你可以 **发现** 它（search/getInfo），但不能用 \`call_hook\` 直接调用，只能输出 fence 让前端渲染。
- 若 Runner 离线或组件不存在，前端会自动展示"离线"状态，无需你处理。
- 若需要在展示前先做数据写操作（如先创建待办再展示），先 \`call_hook\` 完成写操作，再输出 fence 展示。

## 其他对话 / 页面相关

- 主动发消息 / 历史检索：见对话 Hook 技能手册 (bookId=\`local_conversation_hook_skill\`)。SaaS hook 统一是数组形参，单参传 \`[{ ...字段 }]\`。
- 控制前端页面：见 Web Control 技能手册 (bookId=\`local_web_control_skill\`)，仅在已接入 WebMCP 的页面有效。
- Runner 侧能力：先读 Runner 手册 (bookId=\`local_runner_hook_skill\`)。
`,
};

/**
 * 系统手册 — 术语大全章节
 * @keyword-en system-manual-terms-chapter
 */
export const LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_TERMS: KnowledgeChapterInfo = {
  id: 'local_saas_system_hook_skill_terms',
  bookId: 'local_saas_system_hook_skill',
  title: '术语大全',
  sortOrder: 1,
  isLmRequired: false,
  content: `# 术语大全

本章用于做系统概念归一。用户说法可能是口语、缩写或业务别名, 先把词映射到这里的标准术语, 再决定读取哪个章节或调用哪个 hook。

## 身份与权限

| 术语 | 简单说明 | 常见同义说法 |
|------|----------|--------------|
| Agent | 系统中的 AI 主体, 也是 RBAC principal, 有自己的 principalId | 助手、机器人、智能体 |
| Principal | 统一身份主体, 用户、Agent、系统账号、公众号都属于 principal | 主体、账号主体、身份 |
| User | 人类用户账号, 通常有关联邮箱、手机号、密码等登录信息 | 员工、用户、成员 |
| Official Account | 系统通知类主体, 如 ai-notify, 可用于跨会话通知 | 系统通知、官方账号 |
| Organization | 组织容器, 用来承载成员关系和角色分配 | 团队、组织、公司 |
| Membership | principal 加入 organization 后形成的成员关系 | 成员、组织成员、加入关系 |
| Role | 权限角色, 如 owner/admin/member, 通过成员关系赋予主体 | 角色、职位、身份组 |
| Permission / Ability | 后端实际校验的权限定义, prompt 承诺不等于有权限 | 权限、能力、可操作范围 |
| Tenant | 业务租户维度, 用于数据隔离; 不等于 principalId | 租户、业务空间 |

## 对话与记忆

| 术语 | 简单说明 | 常见同义说法 |
|------|----------|--------------|
| Session | IM 会话, 可以是私聊、群聊、Agent 对话线程 | 聊天、会话、线程 |
| Message | 会话内消息, 包含用户消息、Agent 消息、系统通知 | 消息、聊天记录 |
| Mention | 消息里显式 @ 的 Agent 或用户, 用于指定关注对象 | @、提及、叫某人 |
| sessionData | 会话内跨轮记忆与手册指针, 需要 list 后按 key get 详情 | 记忆、会话数据、handbook |
| handbook.* | 系统预置给 Agent 的只读手册指针, 沉淀 LLM 不允许写 | 必读手册、系统手册 |
| callHistory | 最近成功 call_hook 调用流水, 用于复用上一轮结果或 payload | 调用历史、刚刚结果 |
| Knowledge Book | 知识库书本, 包含目录和章节, 可按 tag 搜索 | 知识书、手册、知识库 |
| LM必读 | 任何读取章节时都会附带的关键约束章节 | 必读、基础规则 |

## Hook 与能力发现

| 术语 | 简单说明 | 常见同义说法 |
|------|----------|--------------|
| Hook | 后端注册给 LLM 调用的系统能力入口 | 工具、接口、能力 |
| SaaS Hook | 以 saas.* 开头的平台侧 hook, 不需要 runnerId | 平台 hook、后台能力 |
| Runner Hook | 以 runner.* 开头的 Runner 侧 hook, 通常需要 runnerId | runner 能力、本地执行 |
| Payload | hook 的数组形参载荷; SaaS hook 单参通常是 \`[{...}]\` | 参数、入参 |
| Hook Tag | hook/知识书的真实标签, 发现能力时先看 tag 全景再筛选 | 标签、分类 |

## 业务对象

| 术语 | 简单说明 | 常见同义说法 |
|------|----------|--------------|
| Resource / File | 上传资源或文件访问路径, 前端展示时需要统一解析 URL | 文件、资源、附件 |
| Storage Node | 资源库里的目录或文件节点, 支持移动、重命名、分享 | 网盘节点、文件夹 |
| Share | 资源分享链接或分享配置 | 分享、外链 |
| Solution | 可部署到 Runner 的应用或能力包, SaaS 管元数据和安装编排 | 应用、方案、能力包 |
| Runner | 执行 Solution、Unit Core、数据触点等本地能力的运行节点 | 执行器、节点、运行环境 |
| Todo | SaaS 内轻量协作任务, 可有负责人、关注人、状态、跟进记录 | 待办、任务、提醒 |
| Followup | 待办的过程记录, 描述某次进展或补充信息 | 跟进、进展 |
| Comment | 跟进或待办下的评论 | 评论、回复 |

## 自动化与数据触点

| 术语 | 简单说明 | 常见同义说法 |
|------|----------|--------------|
| 数据触点 | Runner 侧长期数据探针, 观察条件并按需通知用户 | 数据监控、长期监测、条件提醒 |
| Source | 触发数据触点的业务事件来源名, 如 user/auth/order | 数据源、事件源 |
| notifyTargets | 数据触点通知目标表, 绑定 sessionId 与要 @ 的 agentIds | 通知对象、关注人 |
| 胶水代码 | 数据触点执行的用户代码, 自己判断是否 ret.success/skip/error | 触点脚本、处理器 |
| State | 数据触点的上次执行状态, 用于和新数据对比 | 上次状态、缓存状态 |
| Run Log | 数据触点运行历史, 记录 outcome、错误、trace 和日志链 | 运行记录、历史链 |
| Schedule | 数据触点定时触发配置, 支持 cron / interval / once | 定时、计划任务 |

## 时间与页面

| 术语 | 简单说明 | 常见同义说法 |
|------|----------|--------------|
| UTC | 系统存储和 Runner 内部运行的稳定时间基准 | 世界时间、标准时间 |
| IANA Time Zone | 用户本地时区名, 如 Asia/Shanghai | 本地时区、时区 |
| WebMCP | 前端页面控制协议, 已接入页面可读状态或触发动作 | 页面控制、前端控制 |

## 读章节建议

- 身份、权限、成员、角色、员工、用户 → 读 **RBAC 权限管理 Hook**。
- 文件、资源库、目录、分享 → 读 **文件管理 Hook**。
- 应用、方案、安装、Runner 上有什么 → 读 **Solution 管理 Hook**。
- 任务、提醒、状态、跟进、评论 → 读 **待办任务 Hook**。
- 今天、明天、本地时间、UTC、时区 → 读 **时间数据操作 Hook**。
- 长期监控、条件触发、数据异常主动通知 → 读 **Runner 手册 / 数据触点 (Data Touchpoint)**。
`,
};

/**
 * 系统手册 — RBAC 权限管理 Hook 章节
 * @keyword-en saas-system-hook-identity-chapter
 */
export const LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_IDENTITY: KnowledgeChapterInfo = {
  id: 'local_saas_system_hook_skill_identity',
  bookId: 'local_saas_system_hook_skill',
  title: 'RBAC 权限管理 Hook',
  sortOrder: 2,
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
 * 系统手册 — 文件管理 Hook 章节
 * @keyword-en saas-system-hook-storage-chapter
 */
export const LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_STORAGE: KnowledgeChapterInfo = {
  id: 'local_saas_system_hook_skill_storage',
  bookId: 'local_saas_system_hook_skill',
  title: '文件管理 Hook',
  sortOrder: 3,
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
 * 系统手册 — Solution 管理 Hook 章节
 * @keyword-en saas-system-hook-solution-chapter
 */
export const LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_SOLUTION: KnowledgeChapterInfo = {
  id: 'local_saas_system_hook_skill_solution',
  bookId: 'local_saas_system_hook_skill',
  title: 'Solution 管理 Hook',
  sortOrder: 4,
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
 * 系统手册 — 待办任务 Hook 章节
 * @keyword-en saas-system-hook-todo-chapter
 */
export const LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_TODO: KnowledgeChapterInfo = {
  id: 'local_saas_system_hook_skill_todo',
  bookId: 'local_saas_system_hook_skill',
  title: '待办任务 Hook',
  sortOrder: 5,
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
 * 系统手册 — 时间数据操作 Hook 章节
 * @keyword-en saas-system-hook-time-zone-chapter
 */
export const LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_TIME_ZONE: KnowledgeChapterInfo = {
  id: 'local_saas_system_hook_skill_time_zone',
  bookId: 'local_saas_system_hook_skill',
  title: '时间数据操作 Hook',
  sortOrder: 6,
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

详见 Runner 手册的 "数据触点 (Data Touchpoint)" 章节 (bookId=\`local_runner_hook_skill\`).
`,
};

/**
 * Runner 手册 — LM必读章节
 * @keyword-en runner-handbook-lm-required-chapter
 */
export const LOCAL_CHAPTER_RUNNER_HOOK_LM: KnowledgeChapterInfo = {
  id: 'local_runner_hook_skill_lm',
  bookId: 'local_runner_hook_skill',
  title: 'LM必读',
  sortOrder: 0,
  isLmRequired: true,
  content: `# Runner 手册 — LM必读

Runner 是用户自托管的运行时进程, 跟 SaaS 双向 WS 互联。\`runner.*\` hook 都得通过 \`call_hook(target="runner", runnerId="<uuid>", ...)\` 派发, **runnerId 必填且必须是 UUID 格式**。

## ① 调 Runner 前必做: 三步发现 runnerId / hookName / payload schema

### Step 1: 拿 runnerId (UUID)

\`\`\`json
call_hook saas.app.runner.list [{ "status": "mounted" }]
\`\`\`

- \`status="mounted"\` 过滤当前在线可派发的 runner
- 返回 \`items[].id\` 才是 runnerId (UUID 形如 \`019e5852-7ec2-7844-947b-bbb6d3565525\`)
- ❌ **不要用 alias / name 字段当 runnerId** — schema 已强校验 UUID 格式, 错格式立即拒
- 多 runner 场景: 按 alias / description 让用户挑, 或挑 lastSeenAt 最近的

### Step 2: 列 hook 全景

\`\`\`json
tool get_hook_tag [{ "target": "runner", "runnerId": "<uuid>" }]
\`\`\`
返回 tag 频次榜, 按 tag 缩范围:
\`\`\`json
tool search_hook [{ "target": "runner", "runnerId": "<uuid>", "tags": ["mongo"] }]
\`\`\`
拿到 hook 完整名 (4 段 \`platform.app.module.action\`, 例 \`runner.unitcore.mongo.find\`)。

### Step 3: 拿 payload schema

\`\`\`json
tool get_hook_info [{ "target": "runner", "runnerId": "<uuid>", "hookNames": ["runner.unitcore.mongo.find"] }]
\`\`\`
返回 JSON Schema (从 zod 派生), 按 schema 写 payload。

## ② 调用形态 (硬约束)

| 字段 | 形态 | 错误示例 |
|---|---|---|
| \`hookName\` | **4 段完整名** \`platform.app.module.action\` | ❌ "terminal.exec" (短名) / ❌ "saas.app.hook.search" (编造) |
| \`runnerId\` | **UUID** (来自 saas.app.runner.list 的 items[].id) | ❌ "测试Runner" (alias) / ❌ 任意人类可读字符串 |
| \`payload\` | **数组** \`[{ ... }]\` (单参作为长度 1 数组) | ❌ \`{ ... }\` (裸对象) / ❌ \`{ "input": {...}, "args": [...] }\` (旧 envelope) |
| \`target\` | hookName 以 \`runner.\` 开头时工具自动归一为 \`runner\`, 可省 | — |

例:
\`\`\`json
{
  "hookName": "runner.unitcore.terminal.exec",
  "target": "runner",
  "runnerId": "019e5852-7ec2-7844-947b-bbb6d3565525",
  "payload": [{
    "command": "hostname -I",
    "sessionId": "...",
    "mode": "sync",
    "timeout": 5000
  }]
}
\`\`\`

## ③ Runner Hook 命名空间分层

| 前缀 | 含义 | 章节 |
|---|---|---|
| \`runner.unitcore.*\` | Runner Unit Core 基座 (mongo / terminal / file / ast / 用户自挂的 unit) | "Unit Core 基座" 章节 |
| \`runner.app.*\` | Runner 业务模块 (solution / dataTouchpoint / 用户自挂的 app) | "Solution" / "数据触点" 章节 |
| \`runner.system.*\` | Runner 自身元 hook (hookbus 元查询 / identity admin) | "Identity & Ability" 章节 |

\`runner.system.identity.*\` 全部 \`denyLlm: true\`, **LLM 不能直接调** (admin 入口仅供 system/http 调试链路).

## ④ 权限模型 (本地 RBAC + SaaS push hint)

Runner 端**本地维护**完整 RBAC (跟 SaaS app/identity 同语义, 数据存 runner mongo):
- principals / roles / role_permissions / memberships 4 张 collection
- 启动 seed 内置: principal \`system\` + \`anonymous-llm\`; role \`system-root\` + \`solution-default\` + \`llm-anonymous\`

调用源分流 (中间件 \`createRunnerHookAbilityMiddleware\`):
- \`source=system\` / \`source=runner\` (solution 间互调) → **跳过 ability 校验** (信任内部)
- \`source=http\` (调试入口) → 必须本地 principal + ability 校验
- \`source=llm\` (SaaS 派发) → 本地优先查; 本地无 principal 时 fallback 用 SaaS push 的 \`extras.identitySaasHint\` (含 abilityRules + dataPermissions)
- \`denyLlm: true\` 标记的 hook 始终对 LLM 拒, 跟 ability 正交

errorMsg 格式:
- \`permission-denied:<action>:<subject>\` — 缺权限, 不要重试, 用 sendMsg 告诉用户
- \`llm-denied: hook "<name>" is internal-only (denyLlm=true)\` — 该 hook 不开放给 LLM, 换路径
- \`hook-not-found:<name>\` + Correction order 提示 — 名字错, 重新走 get_hook_tag → search_hook 链路

详见 "Identity & Ability" 章节。

## ⑤ ⚠ Runner 时区固定 UTC (硬约束)

> **Runner Docker 镜像 \`TZ=UTC\` 永久写死**, Runner 内部所有时间 (\`Date.now()\` / mongo 默认时间 / 触点元数据 / 运行历史 / 胶水 \`new Date()\`) **统一 UTC**。

胶水代码 / agent 内部:
- ❌ **禁止假设** \`new Date()\` 是当地时间, 它就是 UTC
- ❌ **禁止假设** mongo createdAt 是用户本地, 它就是 UTC
- ✅ 业务需要用户本地视图必须显式调 \`saas.app.timeZone.*\` 转换 (见系统手册的 "时间数据操作 Hook" 章节)

设计目的:
- 跨地域 runner 部署一致 (香港/东京/伦敦 Runner 时间观完全一致, 数据可跨 runner 比对)
- 数据触点链表 \`startedAt\` 顺序稳定 (无 daylight-saving 干扰)
- 跟用户视角解耦, 业务显式做转换

## ⑥ 章节目录

| 章节 | chapterId | 何时读 |
|---|---|---|
| Unit Core 基座 | \`local_runner_hook_skill_unitcore\` | 想用 mongo / terminal / file / ast 等系统原语 |
| Identity & Ability | \`local_runner_hook_skill_identity\` | 想理解权限模型 / 排查 permission-denied / 自建 principal 或 role |
| Solution | \`local_runner_hook_skill_solution\` | 想查/装/卸 runner 上的 solution |
| 数据触点 (Data Touchpoint) | \`local_runner_hook_skill_data_touchpoint\` | 创建/管理长期数据监测点 + 胶水代码 + 主动通知 |

## ⑦ 失败处理总览

| errorMsg 关键词 | 含义 | 处置 |
|---|---|---|
| \`runner-offline\` / \`runner-not-found\` | runner 未在线或 runnerId 错 | 重新 \`saas.app.runner.list\` 拿当前在线 runner |
| \`runner-busy\` | runner 端同时 in-flight ≥ 64 | 等几秒重试; 不是错误是限流 |
| \`hook-not-found:<name>\` | hookName 不对 (常见: 用短名 / 编造名) | 走 get_hook_tag → search_hook 链路重新拿名 |
| \`payload-schema-invalid: <field>: <msg>\` | payload 字段缺/类型错 | 调 \`get_hook_info\` 拿 JSON Schema 后按 schema 改 |
| \`permission-denied:<action>:<subject>\` | 缺 ability | 不要换 runnerId 绕权, 用 sendMsg 告诉用户原因 |
| \`llm-denied: hook "<name>" is internal-only\` | hook 标了 denyLlm | 这个 hook 是系统内部用, 换路径; LLM 不能调底层 mongo 写, 通过 runner.app.* 业务 hook 间接走 |
| \`auth-required\` | LLM 链路缺 principalId | 不应该发生; 出现说明 ctx 注入断了, 报告给上层 |
`,
};

/**
 * Runner 手册 — 数据触点 (Data Touchpoint) 章节
 * @keyword-en runner-hook-data-touchpoint-chapter
 */
export const LOCAL_CHAPTER_RUNNER_HOOK_DATA_TOUCHPOINT: KnowledgeChapterInfo = {
  id: 'local_runner_hook_skill_data_touchpoint',
  bookId: 'local_runner_hook_skill',
  title: '数据触点 (Data Touchpoint)',
  sortOrder: 4,
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

详见系统手册的 "时间数据操作 Hook" 章节 (bookId=\`local_saas_system_hook_skill\`, chapterId=\`local_saas_system_hook_skill_time_zone\`).
`,
};

/**
 * Runner 手册 — Unit Core 基座章节 (mongo / terminal / file / ast)
 * @keyword-en runner-handbook-unitcore-chapter
 */
export const LOCAL_CHAPTER_RUNNER_HOOK_UNITCORE: KnowledgeChapterInfo = {
  id: 'local_runner_hook_skill_unitcore',
  bookId: 'local_runner_hook_skill',
  title: 'Unit Core 基座',
  sortOrder: 1,
  isLmRequired: false,
  content: `# Unit Core 基座 — Runner 系统能力原语

Unit Core 是 Runner 上的"标准库": runner 启动时扫描 \`workspace/\` + \`system-unit/\` 加载 unit 声明, 把每个 unit 的 hook 注册到 RunnerHookBus, 暴露给 AI 产代码 / 上层 runner.app.* 业务调用。

**核心约束**: AI 产出的代码**不允许直接 import** Node API (fs / child_process / mongodb-driver 等), 只能通过 \`runner.unitcore.*\` hook 走 Unit Core。这是沙盒安全边界。

## 系统 Unit 总览

| Unit | hook 前缀 | 用途 | LLM 可调写? |
|---|---|---|---|
| mongo | \`runner.unitcore.mongo.*\` | mongo CRUD (find + 批量 insert/update/delete) | ❌ 写操作 denyLlm |
| terminal | \`runner.unitcore.terminal.*\` | shell 命令执行 (sync/async) | ✅ |
| file | \`runner.unitcore.file.*\` | workspace 内 read/write/delete/list/patchRange | ✅ |
| ast | \`runner.unitcore.ast.*\` | TypeScript/JS AST 分析 (analyze) | ✅ |

## ① mongo: 批量化 CRUD

写操作 (insert/update/delete) 统一接 array, 走 mongo 原生批量路径 (insertMany / bulkWrite)。**写操作均标 \`denyLlm: true\`, LLM 不能直接调底层 mongo**, 业务必须通过 AI 产代码或 runner.app.* 间接走。

| Hook | payload | 备注 |
|---|---|---|
| \`runner.unitcore.mongo.find\` | \`{ db?, collection, filter?, limit? }\` | 只读, LLM ✅ |
| \`runner.unitcore.mongo.insert\` | \`{ db?, collection, docs: [...] }\` | denyLlm; 走 insertMany |
| \`runner.unitcore.mongo.update\` | \`{ db?, collection, ops: [{filter, update, multi?, upsert?}, ...] }\` | denyLlm; 走 bulkWrite |
| \`runner.unitcore.mongo.delete\` | \`{ db?, collection, ops: [{filter, multi?}, ...] }\` | denyLlm; 走 bulkWrite |

**db 字段**: 缺省 → runner 默认 db (\`cfg.runnerDbName\`, 一般 \`runner\`). 跨业务库时显式传 db 名。

例 (插入多条):
\`\`\`json
{
  "hookName": "runner.unitcore.mongo.insert",
  "target": "runner", "runnerId": "<uuid>",
  "payload": [{
    "collection": "todos",
    "docs": [
      { "title": "买菜", "done": false },
      { "title": "写代码", "done": true }
    ]
  }]
}
\`\`\`

返回 \`{ insertedCount, insertedIds }\`。

LLM 想"插一条数据"必须**通过 runner.app.* 业务 hook** (如 \`runner.app.dataTouchpoint.create\`) 间接调; 直接调 mongo.insert 会软错 \`llm-denied\`。

## ② terminal: 同步/异步双模式

\`runner.unitcore.terminal.exec\` 入参:
- \`command\`: shell 命令
- \`sessionId\`: 异步完成时回调通知用的会话 ID
- \`mode\`: \`'sync' | 'async'\`, 默认 sync
- \`timeout\`: 毫秒; sync 默认 30s, async 默认 5 分钟
- \`maxBuffer\`: 输出缓冲上限, 默认 1MB

行为分支:

| mode | 结果 |
|---|---|
| \`sync\` 正常完成 | 直接返 \`{ stdout, stderr, exitCode, durationMs }\`; **不落盘** |
| \`sync\` 超时 (>30s) | 自动转 async, 返 \`{ handleId, status: 'running', hint: 'timeout-switched-to-async' }\`; 后续靠 \`getOutput\` 拿结果 |
| \`async\` | 立即返 \`{ handleId, status: 'running' }\`; 完成后框架通过 \`saas.app.conversation.sendMsg\` 自动通知会话; 用 \`getOutput\` 拿完整结果 |

辅助 hook:

| Hook | payload | 用途 |
|---|---|---|
| \`runner.unitcore.terminal.getStatus\` | \`{ handleId }\` | 查异步任务当前状态 (\`running/completed/failed/timeout\`) |
| \`runner.unitcore.terminal.getOutput\` | \`{ handleId }\` | 拿完整 stdout/stderr/exitCode; **调完后 5 分钟自动批量删盘上记录** |
| \`runner.unitcore.terminal.kill\` | \`{ handleId }\` | 强制 SIGTERM (3s 后 SIGKILL) |
| \`runner.unitcore.terminal.getPoolStatus\` | \`{}\` | 查进程池状态 (active/max/available, 上限 8) |

**记录持久化策略**:
- sync 正常完成: 内存返回, 不写文件
- async 任意完成 / sync 超时转 async: 写 \`workspace/.terminal-records/<handleId>.json\`
- getOutput 调用后: pending-delete 队列加入, 5 分钟后批量 rmSync
- 24h 兜底: 从未 getOutput 的孤儿记录强制清

进程池满 (8 个) 时新 spawn 返 \`{ error: '终端繁忙, 请稍后再试' }\`, 等先调 \`getPoolStatus\` 看可用数, 或者 \`kill\` 释放占着的 handle。

## ③ file: workspace 沙盒内文件操作

所有路径**强制 cwd 限制在 \`workspace/\`**, 路径穿越 (\`../\` 跳出 workspace) 抛 \`path is outside workspace\`. 路径相对 workspace 根, 前导 \`/\` / \`\\\` 自动去掉。

| Hook | payload | 返回值 |
|---|---|---|
| \`runner.unitcore.file.read\` | \`{ path: string }\` | \`{ path, content }\` (utf8 字符串) |
| \`runner.unitcore.file.write\` | \`{ path: string, content: string }\` | \`{ path, ok: true }\`; 覆写, 自动建父目录 |
| \`runner.unitcore.file.delete\` | \`{ path: string }\` | \`{ path, ok: true }\`; **单文件**, 目录请先 list 再逐个删 |
| \`runner.unitcore.file.list\` | \`{ path: string }\` | \`{ path, entries: [{ name, path, isDir }] }\`; 不递归 |
| \`runner.unitcore.file.patchRange\` | 见下方 | \`{ path, ok: true }\` |

\`patchRange\` payload 两种区间**互斥二选一**:

| 区间方式 | 字段 | 语义 |
|---|---|---|
| 按行 | \`{ path, startLine, endLine, content }\` | 替换 [startLine, endLine] 包含, **1-based**; 内部按 \`\\r?\\n\` 拆行 |
| 按字符 | \`{ path, startChar, endChar, content }\` | 替换 [startChar, endChar) **1-based**; 整文件按字符计 |

两组都不传 → 抛 \`invalid patch range\`. \`content\` 是新内容字符串 (可多行)。

例 — 写入配置:
\`\`\`json
{
  "hookName": "runner.unitcore.file.write",
  "target": "runner", "runnerId": "<uuid>",
  "payload": [{
    "path": "solutions/todo-app/config.json",
    "content": "{\\"version\\":\\"1.0\\"}"
  }]
}
\`\`\`

例 — 局部按行替换 (改第 5-7 行为单行注释):
\`\`\`json
{
  "hookName": "runner.unitcore.file.patchRange",
  "target": "runner", "runnerId": "<uuid>",
  "payload": [{
    "path": "src/main.ts",
    "startLine": 5,
    "endLine": 7,
    "content": "// deprecated, removed"
  }]
}
\`\`\`

## ④ ast: TypeScript AST 代码分析

\`runner.unitcore.ast.analyze\` 用 TypeScript compiler API 解析 JS/TS/JSX/MJS/CJS 文件, 提取函数/方法定义 + JSDoc 描述。给 AI 产代码 / Integrator (代码审计 / schema 自动派生) 用。

| 字段 | 类型 | 说明 |
|---|---|---|
| payload | \`{ path: string }\` | 文件路径 (相对 workspace 根) |
| 返回 | \`{ path, functions: Array<{ name, kind, startLine, endLine, jsdoc? }> }\` | functions 按代码顺序; kind 来自 ts.SyntaxKind (FunctionDeclaration / MethodDeclaration / ArrowFunction / FunctionExpression); jsdoc 为函数前注释纯文本, 无注释为 undefined |

⚠ 当前**只识别函数**, 不返回 imports / exports / class 结构. 想要别的请扩展 unit-core 实现, 不要让 LLM 把 ast.analyze 当通用 AST 检索器用。

例:
\`\`\`json
{
  "hookName": "runner.unitcore.ast.analyze",
  "target": "runner", "runnerId": "<uuid>",
  "payload": [{ "path": "src/services/foo.service.ts" }]
}
\`\`\`

返回示意:
\`\`\`json
{
  "path": "src/services/foo.service.ts",
  "functions": [
    {
      "name": "FooService",
      "kind": "MethodDeclaration",
      "startLine": 12,
      "endLine": 28,
      "jsdoc": "@title 处理 foo\\n@description ..."
    }
  ]
}
\`\`\`

## ⑤ 用户自挂 unit (workspace + system-unit 自动扫描)

Runner 启动时 \`UnitCoreService\` 扫两类目录:
- \`workspace/\` — 用户应用自挂的 unit
- \`system-unit/\` — 随 runner 出厂 (mongo / terminal / file / ast)

每个 unit 目录结构:
\`\`\`
<unit-name>/
  unit.hook.ts   // 必须 export const unitHooks: UnitHookModule
  unit.core.ts   // 必须 export const unitCore: UnitCoreModule['handlers']
\`\`\`

### unit.hook.ts 模板

\`\`\`ts
import { z } from 'zod';
import type { UnitHookModule } from '../../types/unit.types';

export const unitHooks: UnitHookModule = {
  unit: {
    name: 'myUnit',  // 跟目录名一致
    description: '...',
    keywordsCn: ['...'],
    keywordsEn: ['...'],
  },
  hooks: [
    {
      name: 'runner.unitcore.myUnit.doStuff',  // 必须 4 段
      description: '...',
      payloadSchema: z.object({ foo: z.string() }),
      denyLlm: false,        // 可选, 默认 false; true 后 LLM 链路拒
      requiredAbility: { action: 'read', subject: 'myUnit' },  // 可选, source=llm/http 时校验
    },
  ],
};
\`\`\`

### unit.core.ts 模板

\`\`\`ts
import type { UnitCoreModule } from '../../types/unit.types';

export const unitCore: UnitCoreModule['handlers'] = {
  'runner.unitcore.myUnit.doStuff': async (ctx, payload) => {
    // ctx: { workspacePath, runnerDbName, invokeHook, mongo: { getDb }, callSaaSHook? }
    // payload: 经 hook schema 校验后的 typed object
    const typed = payload as { foo: string };
    return { result: \`got \${typed.foo}\` };
  },
};
\`\`\`

落 runner 后:
- 自动注册到 hookBus: \`runner.unitcore.myUnit.doStuff\`
- 可通过 \`runner.system.hookbus.search\` / \`get_hook_info\` 看到
- LLM 通过 \`call_hook target=runner\` 即可调

## ⑥ 调试: 看 runner 上全部 unit hook 全景

\`\`\`json
tool get_hook_tag [{ "target": "runner", "runnerId": "<uuid>" }]
\`\`\`
返回 tag 频次榜; UnitCore 注册时统一加 \`pluginName="unit-core"\`, 可:

\`\`\`json
tool search_hook [{ "target": "runner", "runnerId": "<uuid>", "pluginName": "unit-core" }]
\`\`\`
拿到全部 unit hook 一览, 含用户自挂的。
`,
};

/**
 * Runner 手册 — Identity & Ability 章节 (本地 RBAC + 数据权限)
 * @keyword-en runner-handbook-identity-chapter
 */
export const LOCAL_CHAPTER_RUNNER_HOOK_IDENTITY: KnowledgeChapterInfo = {
  id: 'local_runner_hook_skill_identity',
  bookId: 'local_runner_hook_skill',
  title: 'Identity & Ability',
  sortOrder: 2,
  isLmRequired: false,
  content: `# Identity & Ability — Runner 本地 RBAC + 数据权限

Runner 端**本地维护**完整 RBAC, 跟 SaaS app/identity 同语义但精简; 调用源不同走不同校验路径。

## RBAC 数据 (runner mongo)

| Collection | 说明 |
|---|---|
| \`runner_principals\` | 主体: id / type (system/solution/agent/debug/anonymous-llm) / displayName / builtin |
| \`runner_roles\` | 角色: id / code / name / builtin |
| \`runner_role_permissions\` | 权限项: roleId / subject / action / permissionType (management/data) / nodeKey? |
| \`runner_memberships\` | 主体-角色关系: principalId / roleId |

启动 seed (幂等, 重启不重复加):

| Principal | Role 绑定 |
|---|---|
| \`system\` (builtin) | \`system-root\` (subject=\\* action=\\* manage) |
| \`anonymous-llm\` (builtin) | \`llm-anonymous\` (只读 mongo.read / file.read) |
| \`solution:<name>\` | \`solution-default\` (mongo.read / file.read+list / solution.read) — 通过 \`ensureSolutionPrincipal\` lazy 建 |

## Middleware 路由分流

\`createRunnerHookAbilityMiddleware\` 注册到 hookBus, 见 \`event.context.source\` 决定:

| source | 行为 |
|---|---|
| \`system\` / \`runner\` / \`<empty>\` (solution 间互调) | **跳过 ability 校验** (信任内部, denyLlm 仍生效) |
| \`http\` (调试入口) | 必须有 principalId + 本地 ability 校验 |
| \`llm\` (SaaS 派发) | 本地优先查; 本地无该 principal → fallback \`extras.identitySaasHint\` 里的 abilityRules |

\`denyLlm: true\` 始终对 LLM 源拒, 跟 ability 校验**正交**.

## errorMsg 字典

| 错误 | 含义 | 处置 |
|---|---|---|
| \`llm-denied: hook "<name>" is internal-only (denyLlm=true)\` | hook 是系统内部用 (如 mongo 写) | LLM 不能调; 换业务 hook (runner.app.*) 间接走 |
| \`permission-denied:<action>:<subject>\` | 缺权限 | 不要换 runnerId 绕权; 用 sendMsg 告诉用户原因; admin 可通过 \`runner.system.identity.grantPermission\` 加权 |
| \`auth-required\` | source=llm/http 但缺 principalId | ctx 注入断了, 系统级问题, 报告上层 |

## 枚举值清单

\`RunnerPrincipalType\` (runner_principals.type):

| 值 | 何时建 | 说明 |
|---|---|---|
| \`system\` | seed | runner 内置全权主体 |
| \`anonymous-llm\` | seed | SaaS push LLM 调用本地无 principal 时的 fallback 主体 |
| \`solution\` | \`ensureSolutionPrincipal\` | solution:<name> 服务主体 |
| \`agent\` | \`ensureAgentPrincipal\` | agent:<agentId>, AI agent 触发的 hook 用 |
| \`debug\` | 手动 \`upsertPrincipal\` | HTTP/WS 调试端点身份 |

\`RunnerBuiltinRole\` (runner_roles.code, seed 时建):

| Role code | 权限项 |
|---|---|
| \`system-root\` | (subject=\\*, action=\\*) 全权 |
| \`solution-default\` | mongo.read / file.read / file.list / solution.read |
| \`llm-anonymous\` | mongo.read / file.read (写入全禁) |

\`RunnerPermissionType\` (runner_role_permissions.permissionType):

| 值 | 用途 |
|---|---|
| \`management\` | 路由级 can/cannot 判定 (大部分 ability) |
| \`data\` | 数据权限 (走 data-permission 模块 + nodeKey 反查节点函数) |

## Admin Hooks (denyLlm:true, 仅 system/http 入口)

LLM 链路下全部拒, 仅 debug / runner 内部 / 用户运维用. payload schema 列在下方:

### \`runner.system.identity.upsertPrincipal\`
\`\`\`json
[{
  "id": "solution:my-app",
  "type": "solution",
  "displayName": "My App"
}]
\`\`\`
返回 \`{ id }\`. \`type\` 必须是 RunnerPrincipalType 之一; \`builtin\` 字段内部强制 false (运维不能造内置主体)。

### \`runner.system.identity.upsertRole\`
\`\`\`json
[{
  "id": "todo-editor",
  "code": "todo-editor",
  "name": "Todo Editor",
  "description": "可编辑 todo 但不能删"
}]
\`\`\`

### \`runner.system.identity.grantPermission\`
\`\`\`json
[{
  "roleId": "todo-editor",
  "subject": "todo",
  "action": "update",
  "permissionType": "management",
  "nodeKey": null
}]
\`\`\`
- \`permissionType\` 默认 \`management\`, 数据权限时填 \`data\`
- \`nodeKey\` 仅 \`permissionType=data\` 时填 (用于反查 \`dataPermissionRegistry\` 节点函数)
- 幂等 (同 roleId+permissionType+subject+action+nodeKey 重复调安全)
- 调用后自动 \`invalidateCache()\` 全清, 改完立即生效

### \`runner.system.identity.addMembership\`
\`\`\`json
[{ "principalId": "solution:my-app", "roleId": "todo-editor" }]
\`\`\`
幂等. 调用后自动 \`invalidate(principalId)\` 该主体 cache。

### \`runner.system.identity.invalidateCache\`
\`\`\`json
[{ "principalId": "solution:my-app" }]
\`\`\`
\`principalId\` 省略 = 清全部. 用于外部直接改了 mongo RBAC 表后通知 runner 重读。

### \`runner.system.identity.listPrincipals\` / \`listRoles\`
payload \`[{}]\` (空对象), 返 \`{ items, total }\`. debug / 排查用。

## 数据权限 (DataPermission)

跟 SaaS \`core/data-permission\` 同语义, 纯函数声明版.

### 完整端到端示例

**Step 1: solution 启动时 bind 节点函数 + grant data permission**

\`\`\`ts
import { dataPermissionRegistry } from 'runner/modules/data-permission';
import { RunnerPermissionType } from 'runner/modules/identity';

// (1) bind 节点函数 — in-memory, 进程重启需要重新 bind
dataPermissionRegistry.bind({
  table: 'todo',
  action: 'read',
  nodeKey: 'todo:read-only-mine',
  fn: (ctx) => ({
    allow: true,
    where: { ownerId: ctx.principalId },
  }),
  description: '只能看自己创建的 todo',
});

// (2) 给 role 加 data permission (admin hook / 启动 seed / mongo 直写均可)
await identityRepo.grantPermission({
  roleId: 'todo-editor',
  subject: 'todo',
  action: 'read',
  permissionType: RunnerPermissionType.Data,
  nodeKey: 'todo:read-only-mine',
});
\`\`\`

**Step 2: 业务 service mongo CRUD 前求 filter**

\`\`\`ts
import {
  buildDataPermissionContext,
  DataPermissionService,
  dataPermissionRegistry,
} from 'runner/modules/data-permission';

const service = new DataPermissionService(dataPermissionRegistry);
const ctx = await buildDataPermissionContext(ability, {
  principalId: event.context.principalId,
});
const { allow, filter, matchedNodes } = await service.resolve('todo', 'read', ctx);

if (!allow) {
  return { items: [], reason: \\\`blocked by \\\${matchedNodes.join(',')}\\\` };
}
// filter = { ownerId: '<principalId>' } (单 binding 直接是 where; 多 binding 自动 $and 合并)
const items = await mongo.collection('todo').find(filter).toArray();
\`\`\`

### 求值规则

- \`ctx.dataPermissions\` 来自 \`runner_role_permissions\` 表 \`permissionType=data\` 的条目 (subject=table, action=read/update/..., nodeKey 用于反查 fn)
- registry.lookup 按 (table, action, nodeKey) 三元组定位 binding, 多 binding 时 \`$and\` 合并 where
- 任一 fn 返 \`{ allow: false }\` → 整体 \`allow: false\`, 业务 service 应短路 (查空 / 写抛错)
- ctx.dataPermissions 有 nodeKey 但 registry 没 bind 该 nodeKey 的 fn → 默认放开 (跟 SaaS 一致); 业务方可在 service 层覆写 "无定义=拒绝" 策略

### Action 通配

\`ctx.dataPermissions\` 里 action='manage' 或 '*' 命中任意 action; 例如 grant 了 \`(subject=todo, action=manage)\` 的 data permission, 任何 \`resolve('todo', 'read'/'update'/'delete', ...)\` 都会命中。

### 数据权限的 admin 配置

走 \`runner.system.identity.grantPermission\` (denyLlm), 传 \`permissionType: "data"\` + \`nodeKey: "<key>"\`. 改完会自动 invalidateCache 让 RunnerAbilityService 重算。

## 给自己 (solution / agent) 建 principal (lazy helper)

新 solution 加载时:
\`\`\`ts
import { ensureSolutionPrincipal } from 'runner/modules/identity';
const { principalId } = await ensureSolutionPrincipal(identityRepo, 'todo-app');
// principalId === 'solution:todo-app'
// 自动 upsertPrincipal + grant solution-default (mongo.read + file.read/list + solution.read)
\`\`\`

agent 同理:
\`\`\`ts
import { ensureAgentPrincipal } from 'runner/modules/identity';
const { principalId } = await ensureAgentPrincipal(identityRepo, agentId);
// principalId === 'agent:<agentId>', 默认 grant solution-default
\`\`\`

LLM 业务上通常**不需要主动建 principal** — solution 间互调走 \`source=system\` 跳过 ability; principal 只在 source=http/llm 触发 solution hook 时才用上。

## 调试排查 (permission-denied 不知道哪挡的)

按顺序:

1. \`runner.system.identity.listPrincipals\` 看主体存不存在
2. \`runner.system.identity.listRoles\` 看角色清单
3. mongo 直查 \`runner_role_permissions\` 看 role 实际有哪些 (subject, action) 项
4. 看 hookBus 调用 log 里 \`usedSource\` 字段:
   - \`local\` = 本地 RBAC 命中
   - \`hint\` = 本地无, SaaS push hint 兜底
   - \`empty\` = 都没有 → permission-denied 必然
5. 改了权限还报错 → \`runner.system.identity.invalidateCache\` 强清重算 (cache 30s TTL)
`,
};

/**
 * Runner 手册 — Solution 章节
 * @keyword-en runner-handbook-solution-chapter
 */
export const LOCAL_CHAPTER_RUNNER_HOOK_SOLUTION: KnowledgeChapterInfo = {
  id: 'local_runner_hook_skill_solution',
  bookId: 'local_runner_hook_skill',
  title: 'Solution',
  sortOrder: 3,
  isLmRequired: false,
  content: `# Solution — Runner 上的可装载应用单元

Solution 是 runner 上的"应用包": 一组 unit + agent + workflow 的集合, 装到 runner 后通过 hookBus 暴露能力. **每个 runner 上 solution 按 name 唯一**, 数据落在 runner mongo 的 \`solutions\` collection。

## 来源 (\`source\` 字段)

| 值 | 含义 |
|---|---|
| \`self_developed\` | 用户/agent 自己开发的, 放在 runner 的 \`workspace/solutions/<name>/\` |
| \`marketplace\` | 从 SaaS solution 市场拉取的, SaaS 端 \`saas.app.solution.install\` 触发跨进程推送 |

## 包含子项 (\`includes\` 数组, 多选)

| 值 | 含义 |
|---|---|
| \`app\` | UI 应用 (Vue 工程) |
| \`unit\` | Unit Core 扩展 (新 \`runner.unitcore.<unit>.*\` hook) |
| \`workflow\` | 工作流定义 (节点流程图) |
| \`agent\` | AI agent 配置 (system prompt + tool 注入) |

## 业务 hook 列表

| Hook | payload | 返回 | 权限 |
|---|---|---|---|
| \`runner.app.solution.list\` | \`{ source? }\` | \`{ items: SolutionInfo[] }\` | \`read:solution\` |
| \`runner.app.solution.get\` | \`{ name }\` | \`SolutionInfo \\| null\` | \`read:solution\` |
| \`runner.app.solution.search\` | \`{ q?, source?, include? }\` | \`{ items: SolutionInfo[] }\` | \`read:solution\` |
| \`runner.app.solution.delete\` | \`{ name }\` | \`{ deleted: boolean }\`; 物理删 \`workspace/solutions/<name>/\` + mongo 记录 | \`delete:solution\` |

\`SolutionInfo\` 真实结构 (跟 \`runner/src/modules/solution/types/solution.types.ts\` 对齐):

\`\`\`ts
interface SolutionInfo {
  name: string;            // 必填, 唯一
  version: string;         // 必填, semver
  source: 'self_developed' | 'marketplace';
  location: string;        // runner 内绝对路径 (workspace/solutions/<name>)
  summary: string;         // 一句话简述, 列表展示用
  description: string;     // markdown 长描述
  images: string[];        // 插件介绍图 URL 列表
  includes: Array<'app' | 'unit' | 'workflow' | 'agent'>;
  installedAt?: string;    // ISO 时间戳, UTC
}
\`\`\`

## 调用示例

列出 marketplace 来源的 solution:
\`\`\`json
{
  "hookName": "runner.app.solution.list",
  "target": "runner", "runnerId": "<uuid>",
  "payload": [{ "source": "marketplace" }]
}
\`\`\`

按关键词 + 包含 unit 子项的搜:
\`\`\`json
{
  "hookName": "runner.app.solution.search",
  "target": "runner", "runnerId": "<uuid>",
  "payload": [{ "q": "todo", "include": "unit" }]
}
\`\`\`

返回:
\`\`\`json
{
  "items": [
    {
      "name": "todo-app",
      "version": "1.0.0",
      "source": "self_developed",
      "location": "/app/workspace/solutions/todo-app",
      "summary": "简易待办清单",
      "description": "## 功能\\n- 增删 todo\\n- 按 tag 过滤",
      "images": ["https://..."],
      "includes": ["app", "unit"],
      "installedAt": "2026-05-24T05:34:12.000Z"
    }
  ]
}
\`\`\`

卸载:
\`\`\`json
{
  "hookName": "runner.app.solution.delete",
  "target": "runner", "runnerId": "<uuid>",
  "payload": [{ "name": "todo-app" }]
}
\`\`\`

## 文件布局

\`\`\`
workspace/solutions/todo-app/
  solution.json         # 元数据 (SolutionInfo 的子集, 启动期扫盘落 mongo)
  app/                  # 仅 includes 含 'app' 时存在 (Vue 工程)
  unit/                 # 仅 includes 含 'unit' 时存在
    <unit-name>/
      unit.hook.ts      # 自动加载到 runner.unitcore.<unit-name>.*
      unit.core.ts
  workflow/             # 仅 includes 含 'workflow' 时存在 (.workflow.json)
  agent/                # 仅 includes 含 'agent' 时存在 (.agent.json)
\`\`\`

\`solution.json\` 示例:
\`\`\`json
{
  "name": "todo-app",
  "version": "1.0.0",
  "source": "self_developed",
  "summary": "简易待办清单",
  "description": "...",
  "includes": ["app", "unit"]
}
\`\`\`

runner 启动时 \`RunnerSolutionService\` 扫 \`workspace/solutions/\` 落到 mongo \`solutions\` collection. 找不到的 solution \`get\` 返 \`null\`.

## Solution principal (按需 lazy 建)

Solution 装载时调用方可选调 \`ensureSolutionPrincipal(repo, name)\` 自动:
- 建 principal \`solution:<name>\` (type=solution)
- grant role \`solution-default\` (mongo.read + file.read+list + solution.read)

这是为了**solution 自己想做受限调用**时用 (e.g. solution 内部业务代码标 \`ctx.principalId='solution:<name>'\` 调上层 hook 让 ability 校验生效). solution 间互调走 \`source=system\` 时不需要此 principal.

详见 "Identity & Ability" 章节 (\`local_runner_hook_skill_identity\`).

## 跟 SaaS 端 Solution 的关系

| 层 | hook 前缀 | 数据范围 |
|---|---|---|
| SaaS | \`saas.app.solution.*\` | 跨 runner 的 marketplace + 元数据管理 (商品库 / 价格 / 评分) |
| Runner | \`runner.app.solution.*\` | 当前 runner 上**已装**的本地实例 (按 runnerId 隔离) |

LLM 使用 SaaS solution 市场的标准序列:

1. \`saas.app.solution.search\` 在 SaaS marketplace 找候选
2. \`saas.app.solution.install\` 触发 SaaS 把 solution 推到指定 runner (跨进程派发, SaaS WS 调度)
3. \`runner.app.solution.list [{ source: "marketplace" }]\` (target=runner) 确认 runner 上已装
4. \`runner.app.solution.get [{ name }]\` 拿 location 等本地详情, 开始用其暴露的 \`runner.unitcore.*\` / \`runner.app.*\` hook

详见系统手册的 "Solution 操作 Hook" 章节 (bookId=\`local_saas_system_hook_skill\`).

## 调用要点

- 不能跨 runner 直接装/查别的 runner 上的 solution — \`runner.app.solution.*\` 永远指向 \`call_hook\` 的 runnerId 那个 runner. 多 runner 场景要循环每个 runnerId 调一次。
- \`name\` 在 runner 内唯一, 但跨 runner 重名是允许的 (SaaS marketplace 同一个 solution 可装到多个 runner 上)
- \`runner.app.solution.delete\` 物理删目录 + mongo 记录, 不可逆; 调用前最好用 sendMsg 跟用户确认
`,
};

/**
 * Code Agent 开发手册 — LM必读
 * @keyword-en code-agent-handbook-lm-required-chapter
 */
export const LOCAL_CHAPTER_CODE_AGENT_DEVELOPMENT_LM: KnowledgeChapterInfo = {
  id: 'local_code_agent_development_handbook_lm',
  bookId: 'local_code_agent_development_handbook',
  title: 'LM必读',
  sortOrder: 0,
  isLmRequired: true,
  content: `# Code Agent 开发手册 — LM必读

本书是 code-agent 在每轮开发对话中的硬前置知识。只要用户请求涉及代码、项目、Runner、终端指令、应用/Unit/页面开发, 就必须优先按本章执行。

硬规则:

1. 代码相关输出不直接给用户完整文件或 index.html。生成、编辑、写入、项目初始化只能通过 Runner 受控 hook/模板/文件能力执行。
2. 依赖判定优先读取 Runner 数据库里的 Solution/App/Unit 元数据；先确定 runnerId、solutionId、appId 或 unit 能力, 再进入后续代码生成/编辑流程。旧的 Runner code-agent 文件搜索/写入 hook 已移除, 不要再调用。
3. 终端指令也必须在 Runner 中执行。需要运行 npm/npx/test/build/dev server/脚本时, 使用 \`runner.unitcore.terminal.exec\`，并带 target=runner 与已确定 runnerId；不要让用户复制命令到本地跑, 不要在 SaaS 侧执行本地终端。
4. 真实 Solution/App/Unit 元数据以 Runner 为准, SaaS 侧只做会话、聚合与 RPC 调度。
5. Solution 是长期复用的业务解决方案边界, 不是每次任务随手创建的临时容器；开发前必须优先复用已有 solutionName, 未命中时先让用户选择已有 Solution 或明确确认新建。
6. 应用开发再确定 appName；runnerId 只在用户已给出、已有 Solution 绑定多台 Runner，或用户已确认新建 Solution 且存在多台在线 Runner 时才要求。
7. 不要凭记忆猜目录、模板、hook 名。先走 Runner 数据库/Solution/App/Unit 元数据检索, 再读 schema 或进入后续执行节点。
8. 应用初始化前必须先查模板列表, 不允许直接猜模板包或模板名。
9. 没有在线 Runner 或 Runner 目标不可用时, 停止开发流程, 告诉用户等待 Runner 上线或连接 Runner 后再继续；不要提供绕过 Runner 的交付方式。
10. Unit 是小型工具能力, App 是完整底座应用。能用 Unit 解决的, 不要扩成 App；临时表格/单页展示/轻量页面默认使用 Runner 内置 default-view-solution, 不询问是否新建 default-view-solution, 不强制创建 App。
11. 规则不要靠长提示词硬塞。先判定本次是 view/app/unit/solution 哪类结构工程, 再按本书对应章节和 Runner 模块索引执行。普通 view 的标准范式是 multi-file：root 使用候选 \`entryFile\` 作为入口, 用 \`view-compose:start/end\` 注释记录每个 section 的 module/src 来源, 并把 section DOM 静态内联到入口以保证 SEO；\`index.html\` 只是默认入口名, 不是唯一入口。
`,
};

/**
 * Code Agent 开发手册 — 搜索相关依赖
 * @keyword-en code-agent-search-dependencies-chapter
 */
export const LOCAL_CHAPTER_CODE_AGENT_DEVELOPMENT_SEARCH: KnowledgeChapterInfo =
  {
    id: 'local_code_agent_development_handbook_search',
    bookId: 'local_code_agent_development_handbook',
    title: '搜索相关依赖',
    sortOrder: 10,
    isLmRequired: false,
    content: `# 搜索相关依赖

## 总入口

搜索顺序固定:

1. 先查 Solution。SaaS 的 \`saas.app.solution.list\` 不传 runnerId 时会跨 mounted Runner 聚合, 返回 \`runnerIds\` 作为绑定来源。
2. 如果命中唯一绑定 Runner, 后续 Runner hook 使用该 runnerId；如果未命中, 先让用户选择已有 Solution 或明确确认新建, 不要直接创建；轻量 view 的 default-view-solution 例外, 它是 Runner 内置目标。
3. 再查 App, 最后查 Unit/Hook。
4. 搜索命中后再读详情或 schema, 不要直接猜路径或 payload。

## Solution 的搜索方法

Runner 本地 Solution 是真实数据源。

优先链路:

1. \`saas.app.solution.list\`：跨 Runner 聚合 Solution, 优先用 q/name 找候选并读取 \`runnerIds\`。
2. \`runner.app.solution.list/search/get\`：在已确定 runnerId 后读取 Runner 本地详情, 获取 location/includes/isInitialized。
3. 只有用户明确确认新建业务 Solution 时, 才允许用 \`runner.app.solution.ensureTarget\` 创建 Solution；code_gen_orchestrate 必须传 \`allowCreateSolution=true\`。
4. 临时表格、单页展示、轻量页面默认使用 Runner 内置 \`default-view-solution\`；调用 code_gen_orchestrate 时传 \`targetKind="view"\`, 不要询问用户是否创建这个默认 Solution。

注意:

- \`runner.app.solution.*\` 必须带 target=runner 和 runnerId；runnerId 来自已命中 Solution 的 \`runnerIds\`, 或新建时的 Runner 选择。
- SaaS 的 \`saas.app.solution.*\` 是跨 Runner 聚合/市场视角, 不是 Runner 本地落库入口。
- code-agent 确保目标必须走 \`runner.app.solution.ensureTarget\`, 不要在 SaaS 数据库里直接创建 Solution/App；但 Solution 默认只复用, 未命中不得自动新建。
- 如果没有在线 Runner, 不允许直接返回代码或 index.html 作为替代交付；必须提示等待 Runner 上线。

## App 的搜索方法

App 元数据保存在 Runner 管理库 \`runner_apps\`。

优先链路:

1. 先拿 Solution 的 \`solutionId\`。
2. 用 \`runner.unitcore.mongo.find\` 只读查询 runner 管理库:
   - collection: \`runner_apps\`
   - filter: \`{ solutionId }\` 或 \`{ solutionId, name }\`
3. 如果 Solution 已命中、App 未命中且用户要新建应用, 用 \`runner.app.solution.ensureTarget\` 传入 appName/appVersion/appDescription；这只是在已有 Solution 下创建 App。
4. 命中 App 后读取 \`location\`, \`isInitialized\`, \`keywords\`。未初始化时先走应用开发前工作。

注意:

- App 不在 SaaS \`apps\` 表里确定归属；SaaS \`apps\` 仅是旧插件/本地录入兼容层。
- App 搜索不应全文扫 workspace 起步, 除非 metadata 缺失。

## 后续代码图入口

确定 runnerId、solutionId 以及目标是 app 还是 unit 后, 本章只负责依赖判定和目标选择。旧的 Runner code-agent 文件搜索/写入 hook 已移除；新代码图的文件级检索、编辑、checkpoint 和人工选择流程由后续结构重新定义。

当前可依赖的稳定信息:

1. Solution: Runner 本地 Solution 记录, 包含 solutionId/name/summary/description/location/includes/isInitialized。
2. App: Runner 管理库 \`runner_apps\` 中关联到 solutionId/solutionName 的 App 记录, 包含 appId/name/location/isInitialized/keywords。
3. Unit: 先通过 HookBus 查在线 hook, 需要离线索引时再查 \`runner_capabilities\`。
4. Terminal: 仍通过 Runner 终端能力执行测试、构建或模板查询。

## 终端指令执行:

\`\`\`json
{
  "hookName": "runner.unitcore.terminal.exec",
  "target": "runner",
  "runnerId": "<uuid>",
  "payload": [{
    "sessionId": "<sessionId>",
    "command": "npm test",
    "mode": "sync",
    "timeout": 30000
  }]
}
\`\`\`

终端指令只在 Runner workspace 中运行。短命令优先 \`mode=sync\`；构建、dev server、长任务用 async，再通过 \`runner.unitcore.terminal.getStatus\` / \`runner.unitcore.terminal.getOutput\` 查询。不要让用户复制命令到本地执行；不要从 SaaS 侧本地 shell 执行用户项目命令。

## Unit 的搜索方法

Unit 是 Runner Unit Core 或业务扩展 hook 能力。

优先链路:

1. \`runner.system.hookbus.getTag\`：拿当前 Runner hook tag 全景。
2. \`runner.system.hookbus.search\`：按 tags/pluginName 检索候选 hook。
3. \`runner.system.hookbus.getInfo\`：拿候选 hook 的 description、requiredAbility、payloadSchema。
4. 需要更稳定的离线索引时, 用 \`runner.unitcore.mongo.find\` 查 runner 管理库:
   - collection: \`runner_capabilities\`
   - filter 可按 \`unitName\`, \`hookName\`, \`keywordsCn\`, \`keywordsEn\`, \`source\` 收敛。

注意:

- Unit hook 名必须保持四段命名, 典型形态: \`runner.unitcore.<unitName>.<action>\`。
- 先确认是否已有 Unit 能力, 再决定新增。
- 新增 Unit 前要读 Runner 手册的 Unit Core 章节: bookId=\`local_runner_hook_skill\`, chapterId=\`local_runner_hook_skill_unitcore\`。
`,
  };

/**
 * Code Agent 开发手册 — 应用开发前工作
 * @keyword-en code-agent-app-preflight-chapter
 */
export const LOCAL_CHAPTER_CODE_AGENT_DEVELOPMENT_APP_PREFLIGHT: KnowledgeChapterInfo =
  {
    id: 'local_code_agent_development_handbook_app_preflight',
    bookId: 'local_code_agent_development_handbook',
    title: '应用开发前工作',
    sortOrder: 20,
    isLmRequired: false,
    content: `# 应用开发前工作

应用开发是完整底座项目开发, 不是单个工具函数开发。

## 前置确认

开始前必须确认:

1. solutionName / solutionId: 目标业务边界, 默认必须复用已有 Solution。
2. runnerId: 优先从 Solution 的 \`runnerIds\` 推断；只有确认新建 Solution 且多 Runner 时要求用户指定。
3. appName / appId: 目标应用。
4. app 是否已初始化: \`isInitialized\`。
5. 用户是否要新建应用、基于模板初始化、还是修改已有应用。

## 元数据确保

使用 \`runner.app.solution.ensureTarget\`:

- 只传 solutionName: 仅确保已存在 Solution；未命中时默认停止, 不自动新建。default-view-solution 是内置 view 目标例外。
- 同时传 appName: 在已存在 Solution 下确保 App。
- 只有用户明确确认新建 Solution 时, code_gen_orchestrate 才传 \`allowCreateSolution=true\`。
- 轻量 view 需求不要传 appName, 使用 \`default-view-solution\` 和 \`targetKind="view"\`。
- 页面/单页/表格/展示类需求默认按 view 处理, 不要升级成 App, 也不要追问用户是否创建 default-view-solution。
- 新建记录默认 \`isInitialized=false\`。
- App 初始化完成后, 由模板初始化 hook 或后续注册流程更新初始化状态。

## 使用 npx list 查询模板

初始化 App 前必须先查询 Runner 镜像里可用模板。

约定:

1. 模板 CLI 由 Runner 镜像预制, 通过本地 npx 调用。
2. 不允许直接猜模板名。
3. 先执行模板列表查询, 典型命令形态:
   - \`npx <template-cli> list\`
   - 或 \`npx <template-cli> list --json\`
4. 拿到模板列表后, 根据用户需求选择模板。首个目标模板是 Astro 应用底座。
5. 模板选择必须记录到 App 元数据或初始化日志, 方便后续追踪。

## 模板初始化后必须读取

模板生成完成后, 先读取这些信息再规划代码:

1. 文件夹地图: 确认 pages、vueComponent、reactComponent、接口对接层、配置目录等相对路径。
2. tag 预定义库: 只使用模板声明过的受控 tag。
3. module.md 或模板等价说明: 确认模块边界。
4. package.json / scripts: 确认构建、检查、启动命令。

## 规划约束

- 不要把应用业务逻辑写到顶层 utils/lib/helpers/common。
- 先用 tag/目录地图定位大概目录, 再用 grep/AST 精确定位。
- 修改已有文件时优先用小范围 patch, 不做无关重构。
`,
  };

/**
 * Code Agent 开发手册 — UNIT开发前工作
 * @keyword-en code-agent-unit-preflight-chapter
 */
export const LOCAL_CHAPTER_CODE_AGENT_DEVELOPMENT_UNIT_PREFLIGHT: KnowledgeChapterInfo =
  {
    id: 'local_code_agent_development_handbook_unit_preflight',
    bookId: 'local_code_agent_development_handbook',
    title: 'UNIT开发前工作',
    sortOrder: 30,
    isLmRequired: false,
    content: `# UNIT开发前工作

Unit 是一段小的工具代码能力, 通常暴露为 Runner hook。它不承担完整应用底座、页面路由或复杂 UI。

## 先判断是否应该做 Unit

适合 Unit:

- 文件/AST/终端/Mongo 等小工具能力。
- 可被多个 App 复用的单点能力。
- 明确输入 payload, 明确输出结果, 无完整页面生命周期。

不适合 Unit:

- 需要完整路由、页面、布局、接口对接层。
- 需要多目录、多页面、多状态管理的应用底座。
- 需要用户长期直接访问的前端应用。

## 开发前检索

1. 先用 \`runner.system.hookbus.getTag\` 看能力标签。
2. 再用 \`runner.system.hookbus.search\` 搜相关 tag。
3. 对候选 hook 用 \`runner.system.hookbus.getInfo\` 获取 payloadSchema。
4. 必要时查 \`runner_capabilities\`, 避免重复造 Unit。

## 新增 Unit 前必须确定

1. unitName: 必须稳定, 英文小写或项目约定命名。
2. hookName: 必须四段, 形态 \`runner.unitcore.<unitName>.<action>\`。
3. requiredAbility / denyLlm: 外部可调用就声明权限, 危险写操作默认 denyLlm。
4. payloadSchema: 必须用 Zod 声明, 让 getInfo 可导出 schema。
5. keywordsCn / keywordsEn: 方便后续搜索。

## 文件与注册

- 读取 Runner 手册 Unit Core 章节后再写文件。
- 新 Unit 应遵循已有 unit 目录结构, 不发明个人风格。
- 写完后确认 HookBus 可搜索到, 再进行调用测试。
`,
  };

// ----------------------------------------------------------------
// 聚合导出（便于服务层统一访问）
// ----------------------------------------------------------------

/**
 * 所有本地书本列表
 * @keyword-en all-local-books
 */
/**
 * 前端开发手册
 * 每一章是一个「项目定型」(project archetype); LM必读说明默认定型与跨定型硬规则。
 * change-plan 节点在规划前选用本书, 让文件规划遵循定型的目录与拆分约定。
 * @keyword-en frontend-dev-handbook-book
 */
export const LOCAL_BOOK_FRONTEND_DEV: KnowledgeBookInfo = {
  id: 'local_frontend_dev_handbook',
  type: KnowledgeBookType.SKILL,
  name: '前端开发手册',
  description:
    '前端项目定型手册: 每章是一个项目定型 (默认 Astro 站点)。LM必读说明前端一律默认 Astro (含单页/普通页面), 以及跨定型硬规则 (最小模块分块、资源目录分离、页面 JS/CSS 分离)。change-plan 节点规划前端文件前选用本书。',
  creatorId: null,
  isEmbedded: false,
  active: true,
  tags: ['本地知识', '前端', 'Astro', '项目定型', 'CodeAgent', 'changePlan'],
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
};

/**
 * 前端开发手册 — LM必读
 * @keyword-en frontend-dev-handbook-lm-chapter
 */
export const LOCAL_CHAPTER_FRONTEND_DEV_LM: KnowledgeChapterInfo = {
  id: 'local_frontend_dev_handbook_lm',
  bookId: 'local_frontend_dev_handbook',
  title: 'LM必读',
  sortOrder: 0,
  isLmRequired: true,
  content: `# 前端开发手册 — LM必读

本书面向 code-agent 的「文件处理分析 / 变更集规划 (change-plan)」环节。规划一个前端目标 (action=app) 要新增哪些文件时, 必须先按本书定型, 再决定文件结构。

## 项目定型 (一章一定型)

- 本书每一章是一个「项目定型」(project archetype)。先判定本次前端目标属于哪个定型, 再读对应章节按它的目录约定与构建方式规划文件。
- **默认前端定型 = Astro 站点**。无论是多页站点、单页, 还是普通介绍页/营销页, 都默认按「Astro 站点」定型规划; 不要因为页面"看起来简单"就退化成无框架的裸 HTML 单文件。
- **结构以本手册为准 (压过需求里的结构措辞)**: 即使需求里写了"单文件 index.html / 不用框架 / 纯静态 HTML / 一个文件即可"这类话, 也按本手册的 Astro 多文件定型规划 —— 把那类措辞当成"做一个简单自包含站点"的**意图**, 不当字面的文件数/技术栈约束。需求决定内容、板块、文案、视觉; 本手册决定怎么拆文件、用什么栈。

## 跨定型硬规则 (所有前端定型都遵守)

1. **最小模块分块**: 一个文件只承载一个职责 (一个组件 / 一个 section / 一个工具函数集)。禁止把整页所有结构、样式、脚本塞进单个文件。
2. **资源目录分离**: 图片、字体、图标、静态资源放独立资源目录 (Astro 的 \`public/\`), 不与代码源文件混放。
3. **页面 JS 与 CSS 分离**: 页面/组件的脚本与样式拆成独立文件, 不整体内联进 HTML (除少量首屏关键 CSS)。一个页面的 JS、CSS 各自独立。
4. **完整相对路径**: 规划的文件路径是相对该 app 目录的路径 (如 \`src/pages/index.astro\`、\`assets/js/main.js\`), 不要用裸文件名, 不要用 \`..\` 或绝对路径。

## 与 change-plan 的关系

- change-plan 只规划"新增哪些文件 + 每个文件是什么 (summary)", 不写代码正文。
- 按定型把一个前端目标拆成多个文件 (入口 + 组件/section + 样式 + 脚本 + 资源占位), 而不是一个大文件。
`,
};

/**
 * 前端开发手册 — Astro 站点 (默认定型)
 * @keyword-en frontend-dev-handbook-astro-chapter
 */
export const LOCAL_CHAPTER_FRONTEND_DEV_ASTRO: KnowledgeChapterInfo = {
  id: 'local_frontend_dev_handbook_astro',
  bookId: 'local_frontend_dev_handbook',
  title: 'Astro 站点 (默认)',
  sortOrder: 10,
  isLmRequired: false,
  content: `# 项目定型: Astro 站点 (默认)

适用: 所有前端 —— 内容站、企业介绍页、营销页、多页站点、单页, 以及普通页面。这是唯一默认前端定型, 单页/普通页面同样用它, 不退化成裸 HTML 单文件。

## 应用构建 (npx / npm)

构建命令在 Runner workspace 内通过 \`runner.unitcore.terminal.exec\` 执行, 不在本地/SaaS 跑:

1. 脚手架: \`npm create astro@latest <appDir> -- --template minimal --no-install --no-git\` (或 \`npx create-astro@latest <appDir> -- --template minimal\`)。
2. 安装依赖: 在 app 目录 \`npm install\`。
3. 本地开发: \`npm run dev\`。
4. 生产构建: \`npm run build\` → 产物在 \`dist/\`。

## 构建完代码文件怎么放 (目录约定)

- \`src/pages/\` — 路由页面 (\`.astro\`), 一页一文件 (\`index.astro\` 为首页)。
- \`src/components/\` — 可复用组件, **一个组件一个文件** (Hero / Nav / Footer / 各业务 Section 各自独立)。
- \`src/layouts/\` — 页面布局骨架 (\`BaseLayout.astro\`)。
- \`src/styles/\` — CSS, 按页/组件拆分 (\`global.css\`、\`<page>.css\`)。
- \`src/scripts/\` — 页面/交互脚本 (\`.ts\`/\`.js\`), 按职责拆 (如 \`nav.ts\`、\`smooth-scroll.ts\`)。
- \`public/\` — 静态资源 (图片、字体、favicon), 与代码分离, 构建时原样拷到 \`dist/\`。

## 最小模块分块 & JS/CSS 分离

- 把页面拆成 Layout + 若干 Section 组件, 每个组件一个文件; 页面只做组合。
- 组件样式放组件内 \`<style>\` 或对应 \`src/styles/<component>.css\`; 全站样式放 \`src/styles/global.css\`。
- 交互脚本独立到 \`src/scripts/\`, 在组件用 \`<script>\` 引入, 不把大段 JS 堆进 \`.astro\`。

## change-plan 规划示例 (文件清单, 不含代码)

- \`src/layouts/BaseLayout.astro\` — 站点骨架 (head/meta/导航插槽)。
- \`src/pages/index.astro\` — 首页, 组合各 Section。
- \`src/components/Hero.astro\` / \`Nav.astro\` / \`Footer.astro\` 等 — 一区块一组件。
- \`src/styles/global.css\` — 全局样式与主题变量。
- \`src/scripts/main.ts\` — 锚点平滑滚动、移动端菜单等交互。
- \`public/\` — 资源占位 (图片/字体)。
`,
};

export const LOCAL_BOOKS: readonly KnowledgeBookInfo[] = [
  LOCAL_BOOK_CONVERSATION_HOOK,
  LOCAL_BOOK_WEB_CONTROL,
  LOCAL_BOOK_SAAS_SYSTEM_HOOK,
  LOCAL_BOOK_RUNNER_HOOK,
  LOCAL_BOOK_CODE_AGENT_DEVELOPMENT,
  LOCAL_BOOK_FRONTEND_DEV,
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
      LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_TERMS,
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
      LOCAL_CHAPTER_RUNNER_HOOK_UNITCORE,
      LOCAL_CHAPTER_RUNNER_HOOK_IDENTITY,
      LOCAL_CHAPTER_RUNNER_HOOK_SOLUTION,
      LOCAL_CHAPTER_RUNNER_HOOK_DATA_TOUCHPOINT,
    ],
  ],
  [
    'local_code_agent_development_handbook',
    [
      LOCAL_CHAPTER_CODE_AGENT_DEVELOPMENT_LM,
      LOCAL_CHAPTER_CODE_AGENT_DEVELOPMENT_SEARCH,
      LOCAL_CHAPTER_CODE_AGENT_DEVELOPMENT_APP_PREFLIGHT,
      LOCAL_CHAPTER_CODE_AGENT_DEVELOPMENT_UNIT_PREFLIGHT,
    ],
  ],
  [
    'local_frontend_dev_handbook',
    [LOCAL_CHAPTER_FRONTEND_DEV_LM, LOCAL_CHAPTER_FRONTEND_DEV_ASTRO],
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
      LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_TERMS,
      LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_IDENTITY,
      LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_STORAGE,
      LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_SOLUTION,
      LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_TODO,
      LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_TIME_ZONE,
      LOCAL_CHAPTER_RUNNER_HOOK_LM,
      LOCAL_CHAPTER_RUNNER_HOOK_UNITCORE,
      LOCAL_CHAPTER_RUNNER_HOOK_IDENTITY,
      LOCAL_CHAPTER_RUNNER_HOOK_SOLUTION,
      LOCAL_CHAPTER_RUNNER_HOOK_DATA_TOUCHPOINT,
      LOCAL_CHAPTER_CODE_AGENT_DEVELOPMENT_LM,
      LOCAL_CHAPTER_CODE_AGENT_DEVELOPMENT_SEARCH,
      LOCAL_CHAPTER_CODE_AGENT_DEVELOPMENT_APP_PREFLIGHT,
      LOCAL_CHAPTER_CODE_AGENT_DEVELOPMENT_UNIT_PREFLIGHT,
      LOCAL_CHAPTER_FRONTEND_DEV_LM,
      LOCAL_CHAPTER_FRONTEND_DEV_ASTRO,
    ].map((c) => [c.id, c]),
  );

/**
 * 判断一个 ID 是否属于本地知识（前缀 `local_`）
 * @keyword-en is-local-knowledge-id
 */
export function isLocalKnowledgeId(id: string): boolean {
  return id.startsWith('local_');
}
