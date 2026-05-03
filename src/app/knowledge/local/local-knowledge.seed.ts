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
  tags: ['本地知识', 'SaaS', 'Hook', '鉴权管理', '文件管理', '解决方案', '待办'],
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

> ⚠️ **payload 形态注意** :: 本 hook 是 \`@HookHandler\` 直接注册 (不是 \`@HookLifecycle\`)。
> payload 直接就是下面这些字段 — **不要**像 SaaS 系统 Hook 技能手册那样再包 \`{ input: {...} }\` 或 \`args: [...]\`。

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

/**
 * Saas 系统hook技能手册 — LM 必读章节
 * @keyword-en saas-system-hook-lm-required-chapter
 */
export const LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_LM: KnowledgeChapterInfo = {
  id: 'local_saas_system_hook_skill_lm',
  bookId: 'local_saas_system_hook_skill',
  title: 'LM必读',
  sortOrder: 0,
  isLmRequired: true,
  content: `# Saas 系统 Hook 技能手册 — LM 必读

本书覆盖 SaaS 平台内置的管理类 hook (identity / storage / solution / todo 等)。**不要凭名字猜 payload**，先按下面"何时读哪个章节"找到具体章节，再按章节里给的 schema 调用。

## 章节目录

| 章节 ID | 适用场景 |
|---------|----------|
| local_saas_system_hook_skill_identity | 用户、主体、组织、角色、权限定义、成员关系、角色权限 |
| local_saas_system_hook_skill_storage  | 资源库目录、文件节点、复制、分享 |
| local_saas_system_hook_skill_solution | Solution 跨 Runner 查询、CRUD、安装、卸载、标签 |
| local_saas_system_hook_skill_todo     | 待办查询、详情、创建、更新、删除 |

## 调用形态 (本书每张 hook 表都会标注)

lifecycle hook 的 \`payload\` 只有两种形态，每张表的 "形态" 列直接告诉你写哪种：

| 形态 | 标记 | payload 结构 | 何时使用 |
|------|------|--------------|----------|
| 单参 | \`@input\` | \`{ input: { ...字段 } }\` | controller 是单 \`@Query()/@Body()\` 对象。所有 \`*list\` / \`*create\` / 单 body 写操作 |
| 多参 | \`@args(id+body)\` | \`{ input: { ...字段 }, args: ["<id>", { ...字段 }] }\` | controller 形如 \`(@Param('id') id, @Body() dto)\`。所有 \`*get\` / \`*update\` / \`*delete\` 以及带 path id 的写操作 |

**规则**：
- \`@input\` 形态：只填 \`input\`，不要写 \`args\`。
- \`@args(id+body)\` 形态：必须同时填 \`args:["<id>", <input 内容>]\`；只传 \`input\` 会让 controller 第一个参数 (id) 拿到对象、第二个参数 (dto) 为 undefined，必然失败。
- \`args\` 是 \`payload.args\`，跟 \`input\` 同级，**不是**外层工具参数。
- 当前登录身份 (principalId/principalType) 由系统在 hook 调用末尾**自动追加**，**不要**手工写进 args。

## 调用前先看 [session data]

每轮上下文头部会注入 \`[session data]\` 块，列出本会话已写下的事实 (实体 id / 已查过的章节 / 用户偏好等)。**任何 list / get 之前先扫一眼**，命中就直接复用，不要重复 hook。

新查到的 id / title 应主动 \`saas.app.conversation.sessionData.save({ sessionId, key, value, title? })\` 写入，下轮自动注入，节省 token。

## 批量 + 并行 (硬约束)

- 同回合多个独立调用 → 一次性发起多个 \`tool_use\`，**不要串行等结果**。
- \`get_hook_info({ hookNames:[...] })\` / \`saas.app.knowledge.getChapter({ chapterIds:[...] })\` / \`saas.app.knowledge.getToc({ bookIds:[...] })\` 都支持数组形参，**一次拿完**比循环单查节省一整圈延迟。
- 反例：连续 5 次 \`call_hook\` 一一查 schema/列表 = 浪费 5 轮 token + 5 次延迟。

## 占位 / 受限 hook 速避

| Hook | 状态 | 说明 |
|------|------|------|
| saas.app.solution.marketplaceList | 占位 | 市场未上线，固定返回空，不要调 |
| saas.app.solution.purchasesList   | 占位 | 购买记录未上线，固定返回空，不要调 |

## 权限与失败处理

- hook 存在 ≠ 当前会话有权限。\`@CheckAbility\` 校验失败 \`errorMsg\` 含 \`permission/ability/forbidden/unauthorized\` 字样。
- 看到这类错误**立即停止重试**，向用户说明缺少哪个权限即可。**不要**换 hook、runner、terminal 或伪造 principalId 绕权。
- 普通业务错误：先读 \`errorMsg\` 再决定是否调整 payload 重试，不要盲目重发。

## 其他对话 / 页面相关

- 主动发消息 / 历史检索：见对话 Hook 技能手册 (bookId=\`local_conversation_hook_skill\`)。注意 \`saas.app.conversation.sendMsg\` 是 \`@HookHandler\` 直接注册，**payload 直接是字段，不要包 input/args**，与本书形态不同。
- 控制前端页面：见 Web Control 技能手册 (bookId=\`local_web_control_skill\`)，仅在已接入 WebMCP 的页面有效。
- Runner 侧 hook：用 \`get_hook_tag\` / \`search_hook\` / \`get_hook_info\` 走 \`target=runner\` 路由。本书 **仅允许只读查询 Runner**，不允许通过本书改 Runner / 域名 / FRP / 领奖。
`,
};

/**
 * Saas 系统hook技能手册 — 鉴权管理 Hook 章节
 * @keyword-en saas-system-hook-identity-chapter
 */
export const LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_IDENTITY: KnowledgeChapterInfo = {
  id: 'local_saas_system_hook_skill_identity',
  bookId: 'local_saas_system_hook_skill',
  title: '鉴权管理 Hook',
  sortOrder: 1,
  isLmRequired: false,
  content: `# 鉴权管理 Hook

identity 模块的全部 SaaS Hook，覆盖用户、主体、组织、成员关系、角色、权限定义、角色权限。**调用形态遵循 LM 必读章节的 \`@input\` / \`@args(id+body)\` 总则**，本章每张表第二列只标形态，不再展开重复 schema。

## 用户与主体

| Hook | 形态 | 字段 / 说明 |
|------|------|--------------|
| saas.app.identity.userList | \`@input\` | \`{ q?, tenantId?, type? }\`；type ∈ user / user_consumer / system；返回排除 agent / official_account |
| saas.app.identity.userCreate | \`@input\` | \`{ displayName, principalType, email, password?, phone?, tenantId? }\`；事务写 principals + users，邮箱全局唯一 |
| saas.app.identity.userUpdate | \`@args(id+body)\` | body \`{ displayName?, email?, phone?, avatarUrl?, active? }\`；不改密码 |
| saas.app.identity.userDelete | \`@args(id)\`     | 软删 principals + users 两表 |
| saas.app.identity.principalList | \`@input\` | \`{ q?, type?, tenantId? }\`；type ∈ user / user_consumer / official_account / agent / system |
| saas.app.identity.principalCreate | \`@input\` | \`{ displayName, principalType, avatarUrl?, email?, phone?, tenantId? }\`；仅写 principals，不建 user/agent 关联 |
| saas.app.identity.principalUpdate | \`@args(id+body)\` | body \`{ displayName?, avatarUrl?, email?, phone?, active? }\` |
| saas.app.identity.principalDelete | \`@args(id)\` | 软删 principals；关联 membership/user/agent 不级联 |

## 组织与成员

| Hook | 形态 | 字段 / 说明 |
|------|------|--------------|
| saas.app.identity.organizationList | \`@input\` | \`{ q? }\`；q 模糊 name/code |
| saas.app.identity.organizationCreate | \`@input\` | \`{ name, code? }\` |
| saas.app.identity.organizationUpdate | \`@args(id+body)\` | body \`{ name?, code?, active? }\` |
| saas.app.identity.organizationDelete | \`@args(id)\` | 软删，旗下成员/角色不级联 |
| saas.app.identity.membershipList | \`@input\` | \`{ organizationId?, principalId?, roleId?, active? }\`；返回行附带 \`role\` (角色 code, 找不到 roleId 时回退 \`"guest"\`) 和 \`roleName\` (角色显示名, 未匹配返 null)；判断"是否真未绑定"应同时看 \`role==="guest"\` && \`roleName===null\` |
| saas.app.identity.membershipCreate | \`@input\` | \`{ organizationId, principalId, roleId?, role? }\`；roleId / role 二选一 (前者优先)；role 是角色 code (\`admin\` / \`guest\` / 自定义)；\`"owner"\` 自动映射为 \`"admin"\` |
| saas.app.identity.membershipDelete | \`@args(id)\` | 软删 + 置 active=false |

## 角色与权限

| Hook | 形态 | 字段 / 说明 |
|------|------|--------------|
| saas.app.identity.roleList | \`@input\` | \`{ q?, organizationId? }\`；q 模糊 name/code；organizationId 传 \`"null"\` 仅返回系统级角色 |
| saas.app.identity.roleCreate | \`@input\` | \`{ name, code, description?, organizationId? }\`；organizationId 不传 = 系统级 |
| saas.app.identity.roleUpdate | \`@args(id+body)\` | body \`{ name?, description? }\`；code/organizationId 不可改 |
| saas.app.identity.roleDelete | \`@args(id)\` | 软删；已分配 membership 不会清理 |
| saas.app.identity.rolePermissionList | \`@args(id)\` | 返回该角色全部 (subject, action, permissionType) 三元组 |
| saas.app.identity.rolePermissionUpsert | \`@args(id+body)\` | body \`{ items: [{ subject, action, permissionType? }] }\`；replace 语义 (旧权限被软删)；permissionType ∈ management / data / menu；受权重越权防护 |
| saas.app.identity.permissionDefinitionList | \`@input\` | \`{ permissionType?, nodeKey?, fid? }\`；fid 传 \`"null"\` 仅返回各 subject 的 root |
| saas.app.identity.permissionDefinitionCreate | \`@input\` | \`{ fid?, nodeKey, extraData?, description?, permissionType? }\`；extraData 常见键 \`weight\` / \`description\` / \`order\`；data 类节点通常由 \`@DataPermissionNode\` 装饰器启动期自动同步 |
| saas.app.identity.permissionDefinitionUpdate | \`@args(id+body)\` | body 字段同 create；改 nodeKey/fid 谨慎，会影响 RolePermission 引用 |
| saas.app.identity.permissionDefinitionDelete | \`@args(id)\` | **级联软删**节点及其全部子孙 |

## membershipList 调用范例

\`\`\`
// 全量 (未软删)
payload = { input: {} }

// 按组织
payload = { input: { organizationId: "1" } }

// 按主体 (某用户/Agent 在所有组织的关系)
payload = { input: { principalId: "<principalId>" } }

// 按角色 (该角色的所有成员)
payload = { input: { roleId: "<roleId>" } }

// 组合 + 只看启用 (某用户在某组织当前生效的角色)
payload = { input: { organizationId: "1", principalId: "<principalId>", active: true } }
\`\`\`

## 推荐查询流程

- **找某主体的所有角色** :: 先 \`membershipList({ principalId: "<id>" })\` 拿 membership 行 (含 \`role\` code)，再按 code 与 \`roleList\` 结果配对取中文名/描述。
- **找某 subject 下可分配的 action** :: 先 \`permissionDefinitionList({ fid: "null", nodeKey: "<subject>" })\` 拿 subject root id，再 \`permissionDefinitionList({ fid: "<rootId>" })\` 拿子节点。
- **系统级 + 组织级角色并集** :: 同回合两个 tool_use 并行 \`roleList({ organizationId: "null" })\` 与 \`roleList({ organizationId: "<orgId>" })\`。
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

storage 模块已注册的 SaaS Hook，覆盖资源库目录树、文件节点、复制、分享。**调用形态遵循 LM 必读章节总则**。

## 节点管理

| Hook | 形态 | 字段 / 说明 |
|------|------|--------------|
| saas.app.storage.createNode | \`@input\` | \`{ parentId?, name, type, resourceId?, size?, mimeType? }\`；type ∈ folder / file；type=file 通常要先有 resourceId (走 \`POST /storage/upload\` 拿到，**该接口不是 hook**) |
| saas.app.storage.copyNodes | \`@input\` | \`{ nodeIds: string[], targetParentId: string \\| null }\`；文件夹递归复制，自动重命名为 \`xxx (copy)\` |
| saas.app.storage.listNodes | \`@input\` | \`{ parentId?, type?, q? }\`；不传 parentId 返回租户根；type ∈ folder / file |
| saas.app.storage.getRootNodes | \`@input\` | \`{}\`；等价于 listNodes 但只返根 |
| saas.app.storage.getNode | \`@args(id)\` | 返回节点详情 (含 share 状态) |
| saas.app.storage.updateNode | \`@args(id+body)\` | body \`{ name?, parentId? }\`；改名或移动；parentId=null 移到根 |
| saas.app.storage.deleteNode | \`@args(id)\` | 软删 (整子树) |

## 分享管理

| Hook | 形态 | 字段 / 说明 |
|------|------|--------------|
| saas.app.storage.createShare | \`@args(id+body)\` | body \`{ mode, password?, expiresIn? }\`；mode ∈ temp / permanent / password；temp 需 expiresIn (秒)；password 模式需 password |
| saas.app.storage.removeShare | \`@args(id)\` | 取消分享 (清空 share token) |

## 不在本章的能力

- **上传文件** :: \`POST /storage/upload\` (multipart)，不是 hook，LLM 不能直接调；用户上传后会得到 resourceId，可通过 createNode 关联。
- **分享访问** :: \`GET /storage/share/:token\` 是公开 HTTP，不是管理 hook。

## session_data 复用提示

获取 nodeId / shareToken 后如果会被后续轮次复用，立即 \`saas.app.conversation.sessionData.save\` 写入：
- key 命名：\`entity.storage.<slug>\` 存 nodeId；\`entity.share.<slug>\` 存 shareToken。
- 列出节点 (listNodes) 后挑出用户提到的目标节点，把 \`{ id, name, type }\` 写入 session_data，下一轮 update/delete 直接拿 id，不再二次 list。
`,
};

/**
 * Saas 系统hook技能手册 — 解决方案 Hook 章节
 * @keyword-en saas-system-hook-solution-chapter
 */
export const LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_SOLUTION: KnowledgeChapterInfo = {
  id: 'local_saas_system_hook_skill_solution',
  bookId: 'local_saas_system_hook_skill',
  title: '解决方案 Hook',
  sortOrder: 3,
  isLmRequired: false,
  content: `# 解决方案 Hook

solution 模块的 SaaS Hook。**调用形态遵循 LM 必读章节总则**。注意 list 是**跨所有 mounted Runner 并行聚合**，不是单库查询。

## Solution 管理

| Hook | 形态 | 字段 / 说明 |
|------|------|--------------|
| saas.app.solution.list | \`@input\` | \`{ page?, pageSize?, tag?, q?, isInstalled?, isPublished?, source?, runnerId? }\`；不传 runnerId = 跨全部 Runner 聚合 |
| saas.app.solution.get | \`@args(id)\` | 详情；id 可由 list 拿到 |
| saas.app.solution.create | \`@input\` | \`{ runnerIds?, name, version, summary?, description?, iconUrl?, tags?, authorName?, markdownContent?, pluginDir?, isPublished?, source?, location?, images?, includes? }\` |
| saas.app.solution.update | \`@args(id+body)\` | body \`{ summary?, description?, iconUrl?, tags?, markdownContent?, status?, isPublished?, source?, location?, images?, includes? }\`；不可改 name / version |
| saas.app.solution.delete | \`@args(id)\` | 删除 Solution 记录 (不会自动卸载已部署 Runner) |

## 安装与运行

| Hook | 形态 | 字段 / 说明 |
|------|------|--------------|
| saas.app.solution.install | \`@args(id+body)\` | body \`{ runnerIds: string[] }\` (≥1 项)；安装该 solution 到指定 Runner；需要 \`install\` ability |
| saas.app.solution.uninstall | \`@args(id+body)\` | body 同 install；需要 \`uninstall\` ability |
| saas.app.solution.getRunners | \`@input\` | \`{}\`；列出可用 Runner (含 alias / online 状态)，前置查询 install 目标 |
| saas.app.solution.getTags | \`@input\` | \`{}\`；从聚合 Solution 列表统计 tag 频次榜 |

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

1. **查找可装的 Solution + 目标 Runner**:同回合并行 \`list({ q })\` + \`getRunners({})\`，拿到 (solutionId, runnerIds[])。
2. **安装**:\`install\` 用 \`@args(id+body)\` 形态。
3. **session_data 落地**:把 (solutionId, name, version) 与 (runnerId, alias) 写到 session_data，便于后续 update / uninstall 直接复用。
`,
};

/**
 * Saas 系统hook技能手册 — 待办实现 Hook 章节
 * @keyword-en saas-system-hook-todo-chapter
 */
export const LOCAL_CHAPTER_SAAS_SYSTEM_HOOK_TODO: KnowledgeChapterInfo = {
  id: 'local_saas_system_hook_skill_todo',
  bookId: 'local_saas_system_hook_skill',
  title: '待办实现 Hook',
  sortOrder: 4,
  isLmRequired: false,
  content: `# 待办实现 Hook

todo 模块已注册的 SaaS Hook，覆盖待办查询、详情、创建、更新、删除。**调用形态遵循 LM 必读章节总则**。

## Hook 列表

| Hook | 形态 | 字段 / 说明 |
|------|------|--------------|
| saas.app.todo.list | \`@input\` | \`{ status?, followerId?, initiatorId?, q? }\`；不指定 initiatorId/followerId 时服务层按当前 principalId 过滤 |
| saas.app.todo.get | \`@args(id)\` | 详情 |
| saas.app.todo.create | \`@input\` | \`{ initiatorId, title, description?, content?, followerIds?, statusColor?, status? }\`；initiatorId **必须等于**当前登录 principalId |
| saas.app.todo.update | \`@args(id+body)\` | body \`{ title?, description?, content?, followerIds?, statusColor?, status? }\` |
| saas.app.todo.delete | \`@args(id)\` | 软删 |

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

## 不在本章的能力

- 跟进记录 / 评论接口尚未挂 \`@HookLifecycle\`，**不能通过 hook 调用**。如有此需求请走 HTTP \`/todo/:id/followups\` / \`/todo/followups/:id/comments\`。

## session_data 复用提示

- 用户在多轮里追踪同一批 todo (查、改状态、补 description) → 把 \`{ todoIds: [...] }\` 写入 \`progress.todo.<topic>\`，避免每轮重新 list。
- 当前用户的 principalId 推荐写入 \`entity.principal.self\`，create/list 校验时直接复用。
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
    ].map((c) => [c.id, c]),
  );

/**
 * 判断一个 ID 是否属于本地知识（前缀 `local_`）
 * @keyword-en is-local-knowledge-id
 */
export function isLocalKnowledgeId(id: string): boolean {
  return id.startsWith('local_');
}
