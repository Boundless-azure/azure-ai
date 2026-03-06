import * as fs from 'fs';
import * as path from 'path';
import { AIModelService, ChatMessage } from '@/core/ai';
import type {
  CodeGenState,
  ModuleSpec,
  HookSpec,
  PluginSummary,
  GeneratedModule,
} from '../types';

/**
 * @title 代码生成节点（并发）
 * @description 为每个模块生成插件代码，前端用 Gemini 3，后端用 Deepseek
 * 各模块并发生成，互不等待
 */
export async function generateModulesNode(
  state: CodeGenState,
  aiService: AIModelService,
  geminiModelId: string,
  deepseekModelId: string,
): Promise<Partial<CodeGenState>> {
  if (!state.modules || state.modules.length === 0) {
    return { errors: [...(state.errors ?? []), '无模块可生成'] };
  }

  const allHooks = state.hookDesigns ?? [];
  const existingPlugins = state.existingPlugins ?? [];

  /** 拼接所有已知 Hook 供 AI 参考 */
  function buildHookContext(allHookSpecs: HookSpec[]): string {
    return allHookSpecs
      .map(
        (hs) =>
          `【${hs.moduleName}】暴露的 Hook:\n` +
          hs.hooks
            .map((h) => `  - ${h.name}: ${h.payloadDescription}`)
            .join('\n'),
      )
      .join('\n\n');
  }

  /** 已有插件摘要 */
  function buildPluginContext(plugins: PluginSummary[]): string {
    if (plugins.length === 0) return '（暂无已有插件）';
    return plugins
      .map(
        (p) => `  - ${p.name}@${p.version} [${p.pluginDir}]: ${p.description}`,
      )
      .join('\n');
  }

  /**
   * 解析 AI 输出的文件集合
   * 期望格式：
   * ```
   * ===FILE: relative/path/to/file.ts===
   * <file content>
   * ===END===
   * ```
   */
  function parseFiles(raw: string): Array<{ path: string; content: string }> {
    const files: Array<{ path: string; content: string }> = [];
    const regex = /===FILE:\s*(.+?)===\n([\s\S]*?)===END===/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(raw)) !== null) {
      files.push({ path: match[1].trim(), content: match[2] });
    }
    return files;
  }

  /** 将生成文件写入磁盘 */
  function writeFiles(
    moduleName: string,
    files: Array<{ path: string; content: string }>,
  ): string {
    const pluginDir = path.join(process.cwd(), 'plugins', moduleName);
    fs.mkdirSync(pluginDir, { recursive: true });
    for (const f of files) {
      const filePath = path.join(pluginDir, f.path);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, f.content, 'utf-8');
    }
    return `plugins/${moduleName}`;
  }

  /** 生成单个模块（前/后端分开调用对应模型） */
  async function generateOne(mod: ModuleSpec): Promise<GeneratedModule> {
    // 检查是否已存在相同名称的插件，直接复用
    const existing = existingPlugins.find((p) => p.name === mod.name);
    if (existing) {
      return {
        moduleName: mod.name,
        pluginDir: existing.pluginDir,
        files: [],
        skipped: true,
        skipReason: `已有插件 ${existing.name}@${existing.version}，跳过生成`,
      };
    }

    const hookCtx = buildHookContext(allHooks);
    const pluginCtx = buildPluginContext(existingPlugins);
    const thisModuleHooks =
      allHooks.find((h) => h.moduleName === mod.name)?.hooks ?? [];

    const commonRules = `
代码生成规则（严格遵守）：
1. 代码输出到 plugins/${mod.name}/ 目录
2. 模块内只引入模块自身目录内的文件，或 node_modules 包（如 @nestjs/common、vue、react 等）
3. 与其他模块通信一律使用 HookBus：import { HookBusService } from '@/core/hookbus'
4. 必须生成 plugin.conf.ts，格式如下：
   const pluginConfig: PluginConfig = {
     name: '${mod.name}',
     version: '1.0.0',
     description: '...',
     hooks: [ { name: 'onXxx', payloadDescription: '...' } ]
   }
   export default pluginConfig;
5. 使用文件分隔格式输出，每个文件用：
   ===FILE: 相对路径/文件名.ts===
   <文件内容>
   ===END===

全系统 Hook 设计（可监听这些事件）：
${hookCtx}

本模块（${mod.name}）需要暴露的 Hook：
${thisModuleHooks.map((h) => `  - ${h.name}: ${h.payloadDescription}`).join('\n') || '  （无）'}

已有可复用插件：
${pluginCtx}
`;

    const allFiles: Array<{ path: string; content: string }> = [];
    const errors: string[] = [];

    // ── 后端生成（Deepseek） ──
    if (mod.isBackend) {
      const backendMessages: ChatMessage[] = [
        {
          role: 'user',
          content: `请为模块「${mod.name}」生成后端代码（NestJS）。\n模块描述：${mod.description}`,
        },
      ];
      const backendSystem = `你是 NestJS 后端开发专家。\n${commonRules}\n
请生成：
- module.ts（NestJS Module）
- controller.ts（提供 REST 接口，如有）
- service.ts（业务逻辑，监听/发布 HookBus 事件）
- entity.ts（TypeORM 实体，如有持久化需求）
- plugin.conf.ts（插件配置，必须包含）`;

      try {
        const res = await aiService.chat({
          modelId: deepseekModelId,
          messages: backendMessages,
          systemPrompt: backendSystem,
        });
        allFiles.push(...parseFiles(res.content));
      } catch (e) {
        errors.push(
          `后端生成失败: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    // ── 前端生成（Gemini 3） ──
    if (mod.isFrontend) {
      const frontendMessages: ChatMessage[] = [
        {
          role: 'user',
          content: `请为模块「${mod.name}」生成前端代码（Vue 3 + TypeScript）。\n模块描述：${mod.description}`,
        },
      ];
      const frontendSystem = `你是 Vue 3 前端开发专家。\n${commonRules}\n
请生成：
- views/<ModuleName>View.vue（页面组件，如有）
- components/<子组件>.vue（子组件，如有）
- composables/use<Module>.ts（Composable，通过 HookBus HTTP 调用或 WebSocket 监听后端 Hook）
- api/<module>.api.ts（封装 axios 接口调用）

如果无前端页面，只生成 api 文件。`;

      try {
        const res = await aiService.chat({
          modelId: geminiModelId,
          messages: frontendMessages,
          systemPrompt: frontendSystem,
        });
        allFiles.push(...parseFiles(res.content));
      } catch (e) {
        errors.push(
          `前端生成失败: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    // 确保 plugin.conf.ts 存在（如 AI 没有输出则兜底生成）
    const hasConf = allFiles.some((f) => f.path.endsWith('plugin.conf.ts'));
    if (!hasConf) {
      allFiles.push({
        path: 'plugin.conf.ts',
        content: `import type { PluginConfig } from '@/core/plugin/types';

const pluginConfig: PluginConfig = {
  name: '${mod.name}',
  version: '1.0.0',
  description: '${mod.description}',
  hooks: ${JSON.stringify(thisModuleHooks, null, 2)},
};

export default pluginConfig;
`,
      });
    }

    // 写入磁盘
    let pluginDir = `plugins/${mod.name}`;
    try {
      pluginDir = writeFiles(mod.name, allFiles);
    } catch {
      errors.push(`文件写入失败`);
    }

    return {
      moduleName: mod.name,
      pluginDir,
      files: allFiles,
      ...(errors.length > 0 && { skipReason: errors.join('; ') }),
    };
  }

  // 所有模块并发生成
  const generatedModules = await Promise.all(state.modules.map(generateOne));

  return {
    generatedModules,
    currentStep: 'generate-modules',
  };
}
