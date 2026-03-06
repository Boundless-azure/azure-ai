import { PluginService } from '@/core/plugin';
import type { CodeGenState, PluginSummary } from '../types';
import type { HookDescriptor } from '@/core/plugin/types';

/**
 * @title 插件加载节点
 * @description 加载已有插件信息，供生成节点复用
 * @keywords-cn 插件加载, apps, 会话过滤, 复用
 * @keywords-en load-plugins, apps, session-filter, reuse
 */
export async function loadPluginsNode(
  state: CodeGenState,
  pluginService: PluginService,
): Promise<Partial<CodeGenState>> {
  try {
    const allPlugins = await pluginService.list({ sessionId: state.sessionId });

    // 将模块关键词集合用于软匹配
    const moduleNames = new Set(
      (state.modules ?? []).map((m) => m.name.toLowerCase()),
    );
    const moduleDesc = (state.modules ?? []).map((m) =>
      m.description.toLowerCase(),
    );

    const summaries: PluginSummary[] = allPlugins
      .filter((p) => {
        // 过滤出与本次需求相关的插件（按名称或关键词模糊匹配）
        const pName = p.name.toLowerCase();
        const pDesc = (p.description ?? '').toLowerCase();
        const kwZh = (p.keywordsZh ?? '').toLowerCase();
        const kwEn = (p.keywordsEn ?? '').toLowerCase();

        return (
          moduleNames.has(pName) ||
          moduleDesc.some(
            (d) =>
              pDesc.includes(d.slice(0, 8)) || kwZh.includes(d.slice(0, 8)),
          ) ||
          [...moduleNames].some(
            (mn) =>
              pName.includes(mn.slice(0, 6)) || kwEn.includes(mn.slice(0, 6)),
          )
        );
      })
      .map((p) => {
        let hooks: HookDescriptor[] = [];
        try {
          hooks = p.hooks ? (JSON.parse(p.hooks) as HookDescriptor[]) : [];
        } catch {
          hooks = [];
        }
        return {
          name: p.name,
          version: p.version,
          description: p.description ?? '',
          pluginDir: p.pluginDir ?? '',
          hooks,
        } satisfies PluginSummary;
      });

    return {
      existingPlugins: summaries,
      currentStep: 'load-plugins',
    };
  } catch {
    // 插件加载失败不阻断流程
    return {
      existingPlugins: [],
      currentStep: 'load-plugins',
    };
  }
}
