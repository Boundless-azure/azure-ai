// 插件代码生成的统一提示词与上下文构建器
// 目标：根据自然语言意图，生成插件骨架（含 HOOK、plugin.conf.ts、plugin.d.ts 等）

import { parseTipJSDoc, type TipCommentMeta } from './module-tip';

// 内部工具：格式化配置默认值（避免直接 String(...) 触发 lint 规则）
function formatDefaultValue(v: unknown): string {
  if (v === undefined) return '';
  if (typeof v === 'string') {
    const escaped = v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return ` = "${escaped}"`;
  }
  if (typeof v === 'number' || typeof v === 'boolean') {
    return ` = ${String(v)}`;
  }
  try {
    const json = JSON.stringify(v);
    return ` = ${json}`;
  } catch {
    return ' = undefined';
  }
}

// 系统提示词（集中管理）：指导 AI 生成插件代码与文档
export const PLUGIN_GEN_SYSTEM_PROMPT =
  '你是资深的插件代码生成器，请根据用户意图生成完整的 TypeScript 插件骨架：\n' +
  '- 目录建议：<plugin-name>/*.ts；\n' +
  '- 必含文件：plugin.conf.ts、plugin.d.ts；如有需要可包含 <plugin-name>.module.ts、hooks/*.ts、services/*.ts；\n' +
  '- 必含 HOOK：在 HookBus 上注册/解绑（例如 onInit/onLoad/onEvent/onDispose）；\n' +
  '- TS 类型规范：严禁使用类型断言（as、as const、非空断言 !）、@ts-ignore/@ts-expect-error、any；采用明确类型与类型推断，保持严格类型。\n' +
  '- 必含 JSDoc：使用统一标签 @title/@desc/@purpose/@doc/@tip/@keywords-cn/@keywords-en/@module/@file/@function/@method；\n' +
  '- 保持类型安全，导出类型在 plugin.d.ts 中声明；\n' +
  '- plugin.conf.ts 提供可扩展配置项，含默认值与注释；\n' +
  '- 输出采用纯文本代码片段，结构完整，可直接写入文件；\n' +
  '- 遵循统一术语：插件、钩子（HOOK）、配置、服务、模块、控制器。';

// 函数调用（Function Call）场景下的系统提示：要求仅输出 JSON，且每次只生成一个文件代码
export const PLUGIN_GEN_JSON_SYSTEM_PROMPT =
  '你是插件代码生成器（函数调用模式）。严格遵循以下要求：\n' +
  '1) 输出必须是 JSON，且只包含指定字段；不得输出 Markdown 或多余文本；\n' +
  '2) 每次仅生成一个文件的代码（最小块原则），其路径在 plan.nextFile 中；\n' +
  '3) 同时返回完整文件计划（plan.files）、剩余清单（plan.remaining），用于后续迭代调用；\n' +
  '4) 生成的代码必须包含统一 JSDoc 标签（@title/@desc/@purpose/@doc/@tip/@keywords-cn/@keywords-en/@function/@method）；\n' +
  '5) 严禁跨文件合并代码；禁止使用代码围栏；代码只出现在 file.code 字段；\n' +
  '6) 保持类型安全；如为声明文件（.d.ts），确保导出类型完整；\n' +
  '7) 若需要 HOOK，请在 hooks/*.ts 中实现并在模块入口注册；\n' +
  '8) 严格遵守 TS 类型规范：禁止 as、as const、非空断言 !、@ts-ignore/@ts-expect-error、any；避免隐式 any，保持严格类型。';

// 新增：计划阶段（不生成代码，仅返回标准 JSON 计划）
export const PLUGIN_PLAN_JSON_SYSTEM_PROMPT =
  '你是插件规划分析器（函数调用模式-计划阶段）。严格遵循以下要求：\n' +
  '1) 输出必须是 JSON，且只包含指定字段；不得输出 Markdown 或多余文本；\n' +
  '2) 仅返回标准计划（plan），不返回任何代码；\n' +
  '3) 计划需包含全量文件列表（plan.files）、首个生成文件（plan.nextFile）与剩余清单（plan.remaining）；\n' +
  '4) 可包含 intent、features、hooks、configOptions（描述性信息）；\n' +
  '5) 该计划将用于后续异步多次调用逐文件生成代码；';

// 子提示词模板：用来描述“需要生成什么功能”
export const PLUGIN_GEN_SUBPROMPT_TEMPLATE =
  `请为以下插件意图生成代码：\n` +
  `- 插件名：<pluginName>\n` +
  `- 目标/意图：<intent>\n` +
  `- 核心功能：<features>（用逗号或分号分隔）\n` +
  `- 需要的 HOOK：<hooks>（如 onInit,onEvent,onDispose）\n` +
  `- 配置项：<configOptions>（name:type:default:desc 形式）\n` +
  `- 必须生成文件：plugin.conf.ts、plugin.d.ts（可附加更多）\n` +
  `- JSDoc 关键词：@keywords-cn/@keywords-en（可从注释自动提取）`;

export interface PluginGenInput {
  pluginName: string;
  title?: string;
  intent?: string; // 子提示词：一般描述需要生成什么功能
  description?: string; // 辅助描述
  features?: string[]; // 功能点列表
  hooks?: string[]; // 需要建立的 HOOK 列表
  desiredFiles?: string[]; // 需要生成的文件（默认包含 plugin.conf.ts、plugin.d.ts）
  configOptions?: Array<{
    name: string;
    type?: string;
    default?: unknown;
    desc?: string;
  }>;
  jsdocBlocks?: string[]; // 可选：从现有注释块中提取关键词与描述
  keywords?: { cn?: string[]; en?: string[] }; // 额外关键词（与注释解析结果合并）
}

// JSON 输出类型（函数调用场景）
export interface PluginGenJsonPlan {
  files: string[]; // 全量文件计划（相对插件根路径）
  nextFile: string; // 本次应生成的文件路径
  remaining: string[]; // 尚未生成的文件列表
}

export interface PluginGenJsonFile {
  path: string; // 相对路径，如 plugin.conf.ts 或 hooks/init.ts
  language?: string; // ts|d.ts|conf 等
  description?: string;
  code: string; // 仅代码内容（不含围栏）
}

export interface PluginGenJsonResult {
  version: '1.0';
  pluginName: string;
  intent?: string;
  features?: string[];
  hooks?: string[];
  configOptions?: Array<{
    name: string;
    type?: string;
    default?: unknown;
    desc?: string;
  }>;
  plan: PluginGenJsonPlan;
  notes?: string[];
}

export interface PluginPlanJsonResult {
  version: '1.0';
  pluginName: string;
  intent?: string;
  features?: string[];
  hooks?: string[];
  configOptions?: Array<{
    name: string;
    type?: string;
    default?: unknown;
    desc?: string;
  }>;
  plan: PluginGenJsonPlan;
  notes?: string[];
}

/** 构建插件生成的用户上下文（可与系统提示词组合） */
export function buildPluginGenPrompt(
  input: PluginGenInput,
  opts?: { includeAIPrompt?: boolean; systemPrompt?: string },
): string {
  const uniq = <T>(arr?: T[]) =>
    Array.from(new Set((arr || []).filter(Boolean)));
  const join = (arr?: string[], sep = ', ') => uniq(arr).join(sep);

  // 解析 jsdocBlocks 中的关键词与描述
  const metas: TipCommentMeta[] = (input.jsdocBlocks || []).map((b) =>
    parseTipJSDoc(b),
  );
  const jsdocDesc = metas.find((m) => !m.targetName)?.desc || undefined;

  const files = uniq([
    'plugin.conf.ts',
    'plugin.d.ts',
    ...(Array.isArray(input.desiredFiles) ? input.desiredFiles : []),
  ]);

  const cfgLines = (input.configOptions || []).map(
    (c) =>
      `- ${c.name}${c.type ? `: ${c.type}` : ''}${c.default !== undefined ? formatDefaultValue(c.default) : ''}${c.desc ? ` // ${c.desc}` : ''}`,
  );

  const doc = `
插件信息：
- 名称：${input.pluginName}${input.title ? `（${input.title}）` : ''}
- 意图：${(input.intent || input.description || jsdocDesc || '').trim()}
- 功能：${join(input.features)}
- HOOK：${join(input.hooks)}

JSDoc 统一规则（必须覆盖）：
- 标签：@title / @desc/@purpose/@doc/@tip / @keywords-cn / @keywords-en / @module/@file/@function/@method
- 要求：文件、函数/方法均需附带 JSDoc；关键词需覆盖中文/英文，命名与类/方法/函数名相关

需要生成的文件：
${files.map((f) => `- ${f}`).join('\n')}

 配置项（plugin.conf.ts）：
${cfgLines.length ? cfgLines.join('\n') : '- （无）'}
`.trim();

  if (!opts?.includeAIPrompt) return doc + '\n';
  const sys = (opts.systemPrompt || PLUGIN_GEN_SYSTEM_PROMPT).trim();
  const ai = `
#AI_PROMPT
[System Prompt]
${sys}

[User Context]
${doc}
`.trim();
  return ai + '\n';
}

/** 构建“仅输出 JSON”的函数调用提示（每次只返回一个文件代码） */
export function buildPluginGenJsonPrompt(
  input: PluginGenInput,
  opts?: { includeAIPrompt?: boolean; systemPrompt?: string },
): string {
  const uniq = <T>(arr?: T[]) =>
    Array.from(new Set((arr || []).filter(Boolean)));
  const join = (arr?: string[], sep = ', ') => uniq(arr).join(sep);

  const metas: TipCommentMeta[] = (input.jsdocBlocks || []).map((b) =>
    parseTipJSDoc(b),
  );
  const jsdocDesc = metas.find((m) => !m.targetName)?.desc || undefined;

  const files = uniq([
    'plugin.conf.ts',
    'plugin.d.ts',
    ...(Array.isArray(input.desiredFiles) ? input.desiredFiles : []),
  ]);

  // 默认 nextFile：优先 plugin.conf.ts，其次 plugin.d.ts
  const nextFile = files.includes('plugin.conf.ts')
    ? 'plugin.conf.ts'
    : files.includes('plugin.d.ts')
      ? 'plugin.d.ts'
      : files[0];
  const remaining = files.filter((f) => f !== nextFile);

  const cfgLines = (input.configOptions || []).map(
    (c) =>
      `${c.name}${c.type ? `: ${c.type}` : ''}${c.default !== undefined ? formatDefaultValue(c.default) : ''}${c.desc ? ` // ${c.desc}` : ''}`,
  );

  const doc = `
插件（函数调用）
- 名称：${input.pluginName}${input.title ? `（${input.title}）` : ''}
- 意图：${(input.intent || input.description || jsdocDesc || '').trim()}
- 功能：${join(input.features)}
- HOOK：${join(input.hooks)}
- 计划文件：${files.join(', ')}
- 本次生成：${nextFile}
- 剩余：${remaining.join(', ')}
- 配置项：${cfgLines.length ? cfgLines.join(' | ') : '（无）'}

Output JSON schema:
{
  "version": "1.0",
  "pluginName": "string",
  "plan": { "files": [], "nextFile": "string", "remaining": [] },
  "file": {
    "path": "string", "language": "string?", "description": "string?",
    "code": "string"
  },
  "notes": []
}
`.trim();

  if (!opts?.includeAIPrompt) return doc + '\n';
  const sys = (opts.systemPrompt || PLUGIN_GEN_JSON_SYSTEM_PROMPT).trim();
  const ai = `
#AI_PROMPT
[System Prompt]
${sys}

[User Context]
${doc}
`.trim();
  return ai + '\n';
}

export function buildPluginPlanJsonPrompt(
  input: PluginGenInput,
  opts?: { includeAIPrompt?: boolean; systemPrompt?: string },
): string {
  const uniq = <T>(arr?: T[]) =>
    Array.from(new Set((arr || []).filter(Boolean)));
  const join = (arr?: string[], sep = ', ') => uniq(arr).join(sep);

  const metas: TipCommentMeta[] = (input.jsdocBlocks || []).map((b) =>
    parseTipJSDoc(b),
  );
  const jsdocDesc = metas.find((m) => !m.targetName)?.desc || undefined;

  const files = uniq([
    'plugin.conf.ts',
    'plugin.d.ts',
    ...(Array.isArray(input.desiredFiles) ? input.desiredFiles : []),
  ]);

  const nextFile = files.includes('plugin.conf.ts')
    ? 'plugin.conf.ts'
    : files.includes('plugin.d.ts')
      ? 'plugin.d.ts'
      : files[0];
  const remaining = files.filter((f) => f !== nextFile);

  const cfgLines = (input.configOptions || []).map(
    (c) =>
      `${c.name}${c.type ? `: ${c.type}` : ''}${c.default !== undefined ? formatDefaultValue(c.default) : ''}${c.desc ? ` // ${c.desc}` : ''}`,
  );

  const doc = `
插件计划（函数调用-标准 JSON 体）
- 名称：${input.pluginName}${input.title ? `（${input.title}）` : ''}
- 意图：${(input.intent || input.description || jsdocDesc || '').trim()}
- 功能：${join(input.features)}
- HOOK：${join(input.hooks)}
- 计划文件：${files.join(', ')}
- 首个生成：${nextFile}
- 剩余：${remaining.join(', ')}
- 配置项：${cfgLines.length ? cfgLines.join(' | ') : '（无）'}

Output JSON schema:
{
  "version": "1.0",
  "pluginName": "string",
  "intent": "string?",
  "features": [],
  "hooks": [],
  "configOptions": [{ "name": "string", "type": "string?", "default": "any?", "desc": "string?" }],
  "plan": { "files": [], "nextFile": "string", "remaining": [] },
  "notes": []
}
`.trim();

  if (!opts?.includeAIPrompt) return doc + '\n';
  const sys = (opts.systemPrompt || PLUGIN_PLAN_JSON_SYSTEM_PROMPT).trim();
  const ai = `
#AI_PROMPT
[System Prompt]
${sys}

[User Context]
${doc}
`.trim();
  return ai + '\n';
}

export function buildPluginGenPromptFromPlan(
  plan: PluginPlanJsonResult,
  opts?: { includeAIPrompt?: boolean; systemPrompt?: string },
): string {
  const uniq = <T>(arr?: T[]) =>
    Array.from(new Set((arr || []).filter(Boolean)));
  const join = (arr?: string[], sep = ', ') => uniq(arr).join(sep);

  const files = uniq(plan.plan.files);
  const nextFile = plan.plan.nextFile;
  const remaining = plan.plan.remaining;

  const cfgLines = (plan.configOptions || []).map(
    (c) =>
      `- ${c.name}${c.type ? `: ${c.type}` : ''}${c.default !== undefined ? formatDefaultValue(c.default) : ''}${c.desc ? ` // ${c.desc}` : ''}`,
  );

  const doc = `
插件代码生成（从计划驱动，单文件迭代）
- 名称：${plan.pluginName}
- 意图：${(plan.intent || '').trim()}
- 功能：${join(plan.features)}
- HOOK：${join(plan.hooks)}
- 计划文件：${files.join(', ')}
- 本次生成：${nextFile}
- 剩余：${remaining.join(', ')}
- 配置项（仅用于 plugin.conf.ts）：${cfgLines.length ? cfgLines.join('\n') : '（无）'}

代码生成规则：
- 单次只生成一个文件的全部代码（对应上方“本次生成”）。
- TS 类型规范：禁止 as、as const、非空断言 !、@ts-ignore/@ts-expect-error、any；避免隐式 any，保持严格类型。
- JSDoc：文件与函数/方法必须具备统一标签 @title/@desc/@purpose/@doc/@tip/@module/@file/@function/@method。
- HOOK：如为 hooks/*.ts 文件，需实现并在模块入口注册/解绑（onInit/onLoad/onEvent/onDispose 等）。
- 禁止跨文件拼接；代码不得使用围栏（\`\`\`）。
`.trim();

  if (!opts?.includeAIPrompt) return doc + '\n';
  const sys = (opts.systemPrompt || PLUGIN_GEN_SYSTEM_PROMPT).trim();
  const ai = `
#AI_PROMPT
[System Prompt]
${sys}

[User Context]
${doc}
`.trim();
  return ai + '\n';
}

export function buildPluginGenJsonPromptFromPlan(
  plan: PluginPlanJsonResult,
  opts?: { includeAIPrompt?: boolean; systemPrompt?: string },
): string {
  const uniq = <T>(arr?: T[]) =>
    Array.from(new Set((arr || []).filter(Boolean)));
  const join = (arr?: string[], sep = ', ') => uniq(arr).join(sep);

  const files = uniq(plan.plan.files);
  const nextFile = plan.plan.nextFile;
  const remaining = plan.plan.remaining;

  const cfgLines = (plan.configOptions || []).map(
    (c) =>
      `${c.name}${c.type ? `: ${c.type}` : ''}${c.default !== undefined ? formatDefaultValue(c.default) : ''}${c.desc ? ` // ${c.desc}` : ''}`,
  );

  const doc = `
插件代码生成（函数调用-仅输出 JSON，单文件迭代）
- 名称：${plan.pluginName}
- 意图：${(plan.intent || '').trim()}
- 功能：${join(plan.features)}
- HOOK：${join(plan.hooks)}
- 计划文件：${files.join(', ')}
- 本次生成：${nextFile}
- 剩余：${remaining.join(', ')}
- 配置项：${cfgLines.length ? cfgLines.join(' | ') : '（无）'}

Output JSON schema:
{
  "version": "1.0",
  "pluginName": "string",
  "plan": { "files": [], "nextFile": "string", "remaining": [] },
  "file": { "path": "string", "language": "string?", "description": "string?", "code": "string" },
  "notes": []
}
`.trim();

  if (!opts?.includeAIPrompt) return doc + '\n';
  const sys = (opts.systemPrompt || PLUGIN_GEN_JSON_SYSTEM_PROMPT).trim();
  const ai = `
#AI_PROMPT
[System Prompt]
${sys}

[User Context]
${doc}
`.trim();
  return ai + '\n';
}
