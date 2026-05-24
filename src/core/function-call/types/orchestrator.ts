import type {
  PluginGenInput,
  PluginGenJsonResult,
  PluginPlanJsonResult,
} from '../../../prompts/plugin-generator';

/**
 * @title Function Call 调度类型（插件生成两阶段）
 * @file core/function-call/types/orchestrator.ts
 * @desc 定义 plan/generate 两阶段的输入与输出类型，供服务与上层调用共享。
 */

export type PlanParams = {
  phase: 'plan';
  modelId: string;
  temperature?: number;
  input: PluginGenInput;
};

export type GenerateParams = {
  phase: 'generate';
  modelId: string;
  temperature?: number;
  input: PluginGenInput;
  plan: PluginPlanJsonResult;
  nextFile?: string;
};

export type OrchestratorParams = PlanParams | GenerateParams;

/** 阶段化结果类型（联合） */
export type OrchestratorResult = PlanPhaseResult | GeneratePhaseResult;

/** 计划阶段返回 */
export interface PlanPhaseResult {
  phase: 'plan';
  status: 'ok' | 'error';
  plan?: PluginPlanJsonResult;
  error?: string;
  raw?: string;
}

/** 生成阶段返回 */
export interface GeneratePhaseResult {
  phase: 'generate';
  status: 'ok' | 'error';
  result?: PluginGenJsonResult;
  error?: string;
  raw?: string;
}
