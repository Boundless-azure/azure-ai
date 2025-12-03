import type { FunctionCallDescription } from '../types';

/**
 * @title Function Call 描述：plugin_orchestrate
 * @desc 仅由 AI 提供“插件意图输入”，模型选择与温度等由系统控制；
 *       系统据此先生成计划（plan），再按计划执行生成（generate）。
 */
export const PluginOrchestrateFunctionDescription: FunctionCallDescription = {
  name: 'plugin_orchestrate',
  description:
    '先规划（plan）后生成（generate）的单入口函数；仅输出 JSON；用于插件代码生成的函数调用。AI 只需提供插件意图输入，其它参数由系统控制。',
};
