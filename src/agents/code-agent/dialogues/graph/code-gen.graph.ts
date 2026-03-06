import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { AIModelService } from '@/core/ai';
import { PluginService } from '@/core/plugin';
import type {
  CodeGenState,
  HookSpec,
  GeneratedModule,
  ModuleSpec,
  PluginSummary,
} from '../types';
import { requirementsAnalysisNode } from '../nodes/requirements-analysis.node';
import { splitModulesNode } from '../nodes/split-modules.node';
import { hookDesignNode } from '../nodes/hook-design.node';
import { loadPluginsNode } from '../nodes/load-plugins.node';
import { generateModulesNode } from '../nodes/generate-module.node';

/**
 * LangGraph 状态注解
 * 使用 Annotation 定义每个 channel 的 reducer，支持增量合并
 */
const CodeGenAnnotation = Annotation.Root({
  userRequirement: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  sessionId: Annotation<string | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
  projectOverview: Annotation<string | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
  modules: Annotation<ModuleSpec[] | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
  hookDesigns: Annotation<HookSpec[] | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
  existingPlugins: Annotation<PluginSummary[] | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
  generatedModules: Annotation<GeneratedModule[] | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
  errors: Annotation<string[]>({
    reducer: (prev, next) => [...(prev ?? []), ...(next ?? [])],
    default: () => [],
  }),
});

/**
 * @title 代码生成 LangGraph 状态图
 * @description 五节点串行编排：
 *   requirementsAnalysis → splitModules → hookDesign → loadPlugins → generateModules
 * hookDesign 与 generateModules 节点内部各自 Promise.all 并发
 */
export function compileCodeGenGraph(
  aiService: AIModelService,
  pluginService: PluginService,
  opts: {
    deepseekModelId: string;
    geminiModelId: string;
  },
) {
  const graph = new StateGraph(CodeGenAnnotation);

  graph
    .addNode('requirementsAnalysis', (state) =>
      requirementsAnalysisNode(
        state as CodeGenState,
        aiService,
        opts.deepseekModelId,
      ),
    )
    .addNode('splitModules', (state) =>
      splitModulesNode(state as CodeGenState, aiService, opts.deepseekModelId),
    )
    .addNode('hookDesign', (state) =>
      hookDesignNode(state as CodeGenState, aiService, opts.deepseekModelId),
    )
    .addNode('loadPlugins', (state) =>
      loadPluginsNode(state as CodeGenState, pluginService),
    )
    .addNode('generateModules', (state) =>
      generateModulesNode(
        state as CodeGenState,
        aiService,
        opts.geminiModelId,
        opts.deepseekModelId,
      ),
    )
    .addEdge(START, 'requirementsAnalysis')
    .addEdge('requirementsAnalysis', 'splitModules')
    .addEdge('splitModules', 'hookDesign')
    .addEdge('hookDesign', 'loadPlugins')
    .addEdge('loadPlugins', 'generateModules')
    .addEdge('generateModules', END);

  return graph.compile();
}

/**
 * 节点名称 → 中文进度标签
 */
export const NODE_STEP_LABELS: Record<string, string> = {
  requirementsAnalysis: '📋 需求分析中...',
  splitModules: '🔪 分割最小模块...',
  hookDesign: '🔗 设计模块 Hook 接口...',
  loadPlugins: '📦 加载已有插件...',
  generateModules: '⚡ 并发生成模块代码...',
};
