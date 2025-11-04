// TS 导出统一规则提示词，便于在 JS/TS 中直接引入
export const MODULE_TIP_TEMPLATE = `模块说明统一规则\n\n- 说明文件统一使用：module.tip\n- 适用范围：所有模块（core、plugin、redis、ai、tip 等）\n- 内容结构建议：\n  - 模块名（中文/英文）：<title>\n  - 类名/入口：<className>/<entry>\n  - 作用/职责：<purpose>\n  - 导出项：<exports>\n  - 依赖/约束：<dependencies>/<constraints>\n  - 备注：<notes>\n- 编写约定：\n  - 仅使用纯文本，不使用 JSON\n  - 保持简洁，面向 IDE 阅读\n  - 使用统一术语：模块、服务、控制器、插件、配置`;

// AI System Prompt（统一集中管理，避免在控制器/服务中零散书写）
export const MODULE_TIP_SYSTEM_PROMPT =
  '你是资深的技术文档生成器。请严格按照以下“统一规则”生成纯文本的 module.tip：\n' +
  '规则（必须覆盖以下 5 点）：\n' +
  '1) 生成模块的文件说明\n' +
  '2) 生成文件的函数说明或方法说明\n' +
  '3) 生成文件的中英关键词\n' +
  '4) 生成函数的中英关键词\n' +
  '5) 生成模块描述\n' +
  '要求：\n' +
  '- 仅使用纯文本，不使用 JSON；\n' +
  '- 仅引用当前目标目录下的文件路径（避免跨模块）；\n' +
  '- 优先利用 IDE 友好注释（JSDoc 与 @module/@file/@function/@keywords-cn/@keywords-en/@tip/@doc/@purpose）完善说明；\n' +
  '- 关键词需覆盖文件名、类名、方法/函数名（含中英文）；\n' +
  '- 输出内容简洁、准确，便于 IDE 阅读与快速检索。\n' +
  '输出章节顺序（严格遵循）：\n' +
  '1) 目录结构\n' +
  '2) 文件说明\n' +
  '3) 函数说明\n' +
  '4) 关键词索引（中文 / English Keyword Index）\n';

// 统一生成器入参类型（支持目录结构与 AST 解析信息）
export interface ModuleTipInput {
  moduleName: string;
  title?: string;
  className?: string;
  entry?: string;
  description?: string; // 第 5 点：生成模块描述
  exports?: string[];
  dependencies?: string[];
  constraints?: string[];
  notes?: string;
  directoryTree?: string; // 目录结构（文本）
  keywords?: { cn?: string[]; en?: string[] }; // 第 3 点：模块中英关键词
  files?: Array<{
    path: string;
    title?: string;
    description?: string; // 第 1 点：生成模块的文件说明（文件级）
    keywords?: { cn?: string[]; en?: string[] }; // 第 3 点：文件的中英关键词
    functions?: Array<{
      name: string;
      description?: string; // 第 2 点：函数/方法说明
      keywords?: { cn?: string[]; en?: string[] }; // 第 4 点：函数的中英关键词
      signature?: string; // 可由 AST 获取
      comment?: string; // 生成代码时的 IDE 友好注释
    }>;
    methods?: Array<{
      name: string;
      description?: string;
      keywords?: { cn?: string[]; en?: string[] };
      signature?: string;
      comment?: string;
    }>;
  }>;
}

// 统一的 JSDoc 解析规则（集中在 prompts 模块，供所有模块复用）
export interface TipCommentMeta {
  title?: string;
  desc?: string;
  keywords: { cn: string[]; en: string[] };
  targetName?: string; // 目标名称：函数/方法/名称（用于将注释绑定到具体实体）
}

/**
 * 解析 JSDoc 注释块，支持以下标签：
 * - @title：标题
 * - @desc / @purpose / @doc / @tip：描述（择一，按优先级选取）
 * - @keywords-cn：中文关键词，分隔符支持：逗号/分号/顿号/换行
 * - @keywords-en：英文关键词，分隔符支持：逗号/分号/顿号/换行
 * - @function / @method / @name：目标名称（函数/方法/任意名称）
 */
export function parseTipJSDoc(block: string): TipCommentMeta {
  const pickTagLine = (tag: string): string | undefined => {
    const re = new RegExp(`@${tag}\\s*:?[\\t ]*(.+)`, 'i');
    const m = block.match(re);
    return m?.[1]?.trim();
  };
  const splitWords = (s?: string): string[] => {
    if (!s) return [];
    return s
      .split(/[;,，、\n]/)
      .map((t) => t.trim())
      .filter(Boolean);
  };
  const title = pickTagLine('title');
  const desc =
    pickTagLine('desc') ||
    pickTagLine('purpose') ||
    pickTagLine('doc') ||
    pickTagLine('tip');
  const cn = splitWords(pickTagLine('keywords-cn'));
  const en = splitWords(pickTagLine('keywords-en'));
  const targetName =
    pickTagLine('function') || pickTagLine('method') || pickTagLine('name');
  return { title, desc, keywords: { cn, en }, targetName };
}

// 生成 module.tip 文本（纯文本，无 JSON）
export function buildModuleTip(
  data: ModuleTipInput,
  opts?: { includeAIPrompt?: boolean; systemPrompt?: string },
): string {
  const uniqJoin = (list?: string[]) =>
    Array.from(new Set((list || []).filter(Boolean))).join(', ');

  const cnIndex = Array.from(
    new Set(
      [
        ...(data.keywords?.cn || []),
        ...(data.files || []).flatMap((f) => f.keywords?.cn || []),
        ...(data.files || []).flatMap((f) =>
          (f.functions || []).flatMap((fn) => fn.keywords?.cn || []),
        ),
        ...(data.files || []).flatMap((f) =>
          (f.methods || []).flatMap((m) => m.keywords?.cn || []),
        ),
      ].filter(Boolean),
    ),
  );

  const enIndex = Array.from(
    new Set(
      [
        ...(data.keywords?.en || []),
        ...(data.files || []).flatMap((f) => f.keywords?.en || []),
        ...(data.files || []).flatMap((f) =>
          (f.functions || []).flatMap((fn) => fn.keywords?.en || []),
        ),
        ...(data.files || []).flatMap((f) =>
          (f.methods || []).flatMap((m) => m.keywords?.en || []),
        ),
      ].filter(Boolean),
    ),
  );

  const doc = `
    目录结构：
    ${(data.directoryTree || '').trim()}

    文件说明：
    ${(data.files || [])
      .map(
        (f) => `- 文件：${f.path}${f.title ? `（${f.title}）` : ''}
    ${f.description ? `  - 说明：${f.description}\n` : ''}${uniqJoin(f.keywords?.cn) ? `  - 关键词（中文）：${uniqJoin(f.keywords?.cn)}\n` : ''}${uniqJoin(f.keywords?.en) ? `  - Keywords (EN)：${uniqJoin(f.keywords?.en)}\n` : ''}`,
      )
      .join('\n')}

    函数说明：
    ${(data.files || [])
      .flatMap((f) => [
        ...(f.functions || []).map((fn) => ({ type: '函数', ...fn })),
        ...(f.methods || []).map((m) => ({ type: '方法', ...m })),
      ])
      .map(
        (
          it,
        ) => `- ${it.type}：${it.name}${it.signature ? ` | ${it.signature}` : ''}
    ${it.description ? `  - 说明：${it.description}\n` : ''}${it.comment ? `  - 注释：${it.comment}\n` : ''}${uniqJoin(it.keywords?.cn) ? `  - 关键词（中文）：${uniqJoin(it.keywords?.cn)}\n` : ''}${uniqJoin(it.keywords?.en) ? `  - Keywords (EN)：${uniqJoin(it.keywords?.en)}\n` : ''}`,
      )
      .join('\n')}

    关键词索引（中文 / English Keyword Index）：
    中文：${cnIndex.join(', ')}
    English: ${enIndex.join(', ')}

    模块描述：
    ${(data.description || '').trim()}
    `.trim();

  if (!opts?.includeAIPrompt) {
    return doc + '\n';
  }

  const sys = (opts.systemPrompt || MODULE_TIP_SYSTEM_PROMPT).trim();
  const aiCtx = `
    #AI_PROMPT
    [System Prompt]
    ${sys}

    [User Context]
    目录结构（from data.directoryTree）：
    ${(data.directoryTree || '').trim()}

    文件与函数索引：
    ${(data.files || [])
      .map((f) => {
        const lines: string[] = [];
        lines.push(`- 文件：${f.path}${f.title ? `（${f.title}）` : ''}`);
        if (f.description) lines.push(`  - 说明：${f.description}`);
        const fcn = uniqJoin(f.keywords?.cn);
        if (fcn) lines.push(`  - 关键词（中文）：${fcn}`);
        const fen = uniqJoin(f.keywords?.en);
        if (fen) lines.push(`  - Keywords (EN)：${fen}`);
        for (const fn of f.functions || []) {
          lines.push(
            `  - 函数/方法：${fn.name}${fn.signature ? ` | ${fn.signature}` : ''}`,
          );
          if (fn.description) lines.push(`    - 说明：${fn.description}`);
          if (fn.comment) lines.push(`    - 注释：${fn.comment}`);
          const cn = uniqJoin(fn.keywords?.cn);
          if (cn) lines.push(`    - 关键词（中文）：${cn}`);
          const en = uniqJoin(fn.keywords?.en);
          if (en) lines.push(`    - Keywords (EN)：${en}`);
        }
        for (const m of f.methods || []) {
          lines.push(
            `  - 方法：${m.name}${m.signature ? ` | ${m.signature}` : ''}`,
          );
          if (m.description) lines.push(`    - 说明：${m.description}`);
          if (m.comment) lines.push(`    - 注释：${m.comment}`);
          const cn = uniqJoin(m.keywords?.cn);
          if (cn) lines.push(`    - 关键词（中文）：${cn}`);
          const en = uniqJoin(m.keywords?.en);
          if (en) lines.push(`    - Keywords (EN)：${en}`);
        }
        return lines.join('\n');
      })
      .join('\n')}
    `.trim();
  return doc + '\n\n' + aiCtx + '\n';
}
