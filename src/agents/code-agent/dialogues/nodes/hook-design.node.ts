import { AIModelService, ChatMessage } from '@/core/ai';
import type { CodeGenState, HookSpec, ModuleSpec } from '../types';

/**
 * @title Hook 设计节点
 * @description 为每个模块设计对外暴露的 Hook 接口（并发执行）
 * 必须在生成节点之前完成，确保所有模块生成时能引用其他模块的 Hook
 */
export async function hookDesignNode(
  state: CodeGenState,
  aiService: AIModelService,
  deepseekModelId: string,
): Promise<Partial<CodeGenState>> {
  if (!state.modules || state.modules.length === 0) {
    return {
      errors: [...(state.errors ?? []), '模块列表为空，跳过 Hook 设计'],
    };
  }

  const systemPrompt = `你是一名资深后端架构师，擅长插件化与事件驱动系统设计。
为指定模块设计它对外暴露的 Hook（事件）列表。

规则：
1. Hook 名称格式：on<模块名PascalCase><事件>，例如 onCustomerCreated、onLeadStatusChanged
2. 每个 Hook 需要一条 payloadDescription（中文），说明该 Hook 触发时传递的数据
3. 只设计当前模块的 Hook，不要设计其他模块
4. 数量适当，通常 3-8 个

仅输出如下 JSON，不要有任何额外说明：
{
  "moduleName": "module-name",
  "hooks": [
    { "name": "onXxxYyy", "payloadDescription": "..." }
  ]
}`;

  /**
   * 针对单个模块设计 Hook
   */
  async function designHooksForModule(mod: ModuleSpec): Promise<HookSpec> {
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: `模块名：${mod.name}\n模块描述：${mod.description}`,
      },
    ];
    const result = await aiService.chat({
      modelId: deepseekModelId,
      messages,
      systemPrompt,
    });

    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as HookSpec;
      }
    } catch {
      // fallback
    }
    // 解析失败则返回空 hook 列表
    return { moduleName: mod.name, hooks: [] };
  }

  // 并发：各模块 Hook 设计同时进行
  const hookDesigns = await Promise.all(
    state.modules.map(designHooksForModule),
  );

  return {
    hookDesigns,
    currentStep: 'hook-design',
  };
}
