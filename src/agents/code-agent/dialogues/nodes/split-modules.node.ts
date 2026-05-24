import { AIModelService, ChatMessage } from '@/core/ai';
import type { CodeGenState, ModuleSpec } from '../types';

/**
 * @title 模块分割节点
 * @description 将项目概述拆解成最小独立模块
 */
export async function splitModulesNode(
  state: CodeGenState,
  aiService: AIModelService,
  deepseekModelId: string,
): Promise<Partial<CodeGenState>> {
  if (!state.projectOverview) {
    return {
      errors: [...(state.errors ?? []), '需求分析结果为空，无法拆分模块'],
    };
  }

  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `项目概述：\n${state.projectOverview}`,
    },
  ];

  const systemPrompt = `你是一名资深软件架构师。
根据项目概述，将系统拆分为多个独立的最小功能模块（插件）。

规则：
1. 每个模块功能单一、职责清晰，粒度尽量细
2. 模块间不允许直接引用对方代码，所有跨模块通信通过 Hook 机制实现
3. 模块名称使用英文 kebab-case，如 customer-management、lead-tracking
4. 每个模块说明它是否需要后端（isBackend）和/或前端（isFrontend）

仅输出如下 JSON 数组，不要有任何额外说明：
[
  {
    "name": "module-name",
    "description": "模块功能描述（中文）",
    "isBackend": true,
    "isFrontend": true
  }
]`;

  const result = await aiService.chat({
    modelId: deepseekModelId,
    messages,
    systemPrompt,
  });

  let modules: ModuleSpec[] = [];
  try {
    // 提取 JSON 数组（防止 AI 输出 markdown code block）
    const jsonMatch = result.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      modules = JSON.parse(jsonMatch[0]) as ModuleSpec[];
    }
  } catch {
    return {
      errors: [
        ...(state.errors ?? []),
        `模块分割 JSON 解析失败: ${result.content.slice(0, 200)}`,
      ],
    };
  }

  return {
    modules,
    currentStep: 'split-modules',
  };
}
