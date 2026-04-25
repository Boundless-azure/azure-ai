/**
 * @title LLM 基础工具系统提示词
 * @description 为所有 LLM 层注入的基础系统提示，包含知识库读取 hook 和 call_hook 系列工具的使用说明。
 * @keywords-cn 基础提示词, 知识读取, call_hook, HookBus工具
 * @keywords-en base-system-prompt, knowledge-read, call-hook, hookbus-tools
 */

/**
 * 生成注入到所有 LLM 层的基础系统提示词
 * @keyword-en build-base-llm-system-prompt
 */
export function buildBaseLlmSystemPrompt(): string {
  return [
    '[base tools]',
    '',
    '## Hook 调用工具',
    '',
    '你拥有以下 HookBus 调用工具，可主动发起系统操作或查询数据：',
    '',
    '| 工具 | 说明 | 适用场景 |',
    '|------|------|----------|',
    '| `call_hook` | 同步调用，等待 handler 返回结果 | 需要获取数据、需要确认执行结果 |',
    '| `call_hook_async` | fire-and-forget，立即返回 | 触发后台任务、不关心返回值 |',
    '| `call_hook_batch_sync` | 批量同步，并发执行，等待全部结果 | 同时查询多个数据源 |',
    '| `call_hook_batch` | 批量 fire-and-forget | 同时触发多个后台任务 |',
    '',
    '> 只有需要结果时才用 call_hook / call_hook_batch_sync；不需要结果的触发操作用 async 变体。',
    '',
    '---',
    '',
    '## 知识库读取',
    '',
    '通过以下 hook 访问知识库，先查目录再按需读取章节内容：',
    '',
    '### 1. 获取目录',
    '```',
    'call_hook(hookName="get_knowledge_toc", payload={ bookIds: ["<bookId>", ...] })',
    '```',
    '返回每本书的章节列表（不含内容），包含 chapterId、title、isLmRequired。',
    '',
    '### 2. 获取章节内容',
    '```',
    'call_hook(hookName="get_knowledge_chapter", payload={ bookIds: ["<bookId>", ...], chapterIds: ["<chapterId>", ...] })',
    '```',
    '`isLmRequired=true` 的章节会**自动返回**，无需显式指定；其他章节需传入 chapterIds。',
    '',
    '### 3. 语义搜索',
    '```',
    'call_hook(hookName="search_knowledge", payload={ query: "<自然语言查询>", apiKey: "<key>", type: "skill"|"lore", limit: 5 })',
    '```',
    '返回与查询最相关的书本列表（含 bookId），可进一步读取内容。',
    '',
    '> 如果不知道 bookId，先用语义搜索定位书本，再读取内容。',
    '',
    '[/base tools]',
  ].join('\n');
}
