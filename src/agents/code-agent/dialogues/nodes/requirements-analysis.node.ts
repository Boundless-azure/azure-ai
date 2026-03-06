import { AIModelService, ChatMessage } from '@/core/ai';
import type { CodeGenState } from '../types';

/**
 * @title 需求分析节点
 * @description 分析用户原始需求，输出项目概述
 */
export async function requirementsAnalysisNode(
  state: CodeGenState,
  aiService: AIModelService,
  deepseekModelId: string,
): Promise<Partial<CodeGenState>> {
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: state.userRequirement,
    },
  ];

  const systemPrompt = `你是一名资深软件架构师。
用户会描述一个软件系统的需求，你需要输出一份清晰的项目功能概述（中文），涵盖：
1. 系统整体目标
2. 核心业务领域
3. 主要用户角色
4. 关键功能点

只输出项目概述文本，不要输出 JSON，不要输出代码。`;

  const result = await aiService.chat({
    modelId: deepseekModelId,
    messages,
    systemPrompt,
  });

  return {
    projectOverview: result.content,
    currentStep: 'requirements-analysis',
  };
}
