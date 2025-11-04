import { Injectable, Logger } from '@nestjs/common';
import { AIModelService } from '../../ai/services/ai-model.service';
import type { ChatMessage, AIModelResponse } from '../../ai/types';
import {
  PLUGIN_PLAN_JSON_SYSTEM_PROMPT,
  PLUGIN_GEN_JSON_SYSTEM_PROMPT,
  buildPluginPlanJsonPrompt,
  buildPluginGenJsonPromptFromPlan,
} from '../../../prompts/plugin-generator';
import type {
  PluginGenJsonResult,
  PluginPlanJsonResult,
} from '../../../prompts/plugin-generator';
import type {
  PlanParams,
  GenerateParams,
  OrchestratorParams,
  OrchestratorResult,
  PlanPhaseResult,
  GeneratePhaseResult,
} from '../types/orchestrator';
import type {
  FunctionCallHandle,
  FunctionCallServiceContract,
} from '../types/service.types';
import { PluginOrchestrateFunctionDescription } from '../descriptions/plugin/orchestrate';

/**
 * @title 插件生成协同服务（Function Call 用）
 * @module core/function-call/services
 * @file plugin.orchestrator.service.ts
 * @desc 为主对话的函数调用提供“先规划、后生成”的两阶段异步能力：
 * 1) 计划阶段：基于自然语言意图返回标准 JSON 计划（不输出代码）。
 * 2) 生成阶段：根据既定计划，每次仅生成一个文件的代码（JSON-only）。
 * @keywords-cn 函数调用, 插件, 规划, 代码生成, 异步
 * @keywords-en function-call, plugin, plan, codegen, async
 */
@Injectable()
export class PluginOrchestratorService implements FunctionCallServiceContract {
  private readonly logger = new Logger(PluginOrchestratorService.name);

  constructor(private readonly aiModelService: AIModelService) {}

  /**
   * @title 主入口函数（两阶段）
   * @function orchestrate
   * @desc 通过 phase 区分阶段："plan" 仅返回计划；"generate" 按计划生成单文件代码。
   * @param params 调用参数（包含 phase 与所需数据）
   */
  async orchestrate(params: OrchestratorParams): Promise<OrchestratorResult> {
    if (params.phase === 'plan') {
      return this.runPlanPhase(params);
    }
    return this.runGeneratePhase(params);
  }

  /**
   * 提供标准化的函数句柄：plugin_orchestrate
   */
  getHandle(): FunctionCallHandle {
    return {
      name: PluginOrchestrateFunctionDescription.name,
      description: PluginOrchestrateFunctionDescription,
      validate: (v: unknown): boolean => {
        if (!isObject(v)) return false;
        const input = v['input'];
        if (!isObject(input)) return false;
        const pluginName = input['pluginName'];
        return typeof pluginName === 'string' && pluginName.length > 0;
      },
      execute: async (args: unknown): Promise<unknown> => {
        // 由系统侧负责补齐 phase/modelId/temperature/plan 等参数
        if (!isOrchestratorParams(args)) {
          throw new Error(
            'plugin_orchestrate 需要系统补齐的参数：phase/modelId/temperature/(plan,nextFile) 等',
          );
        }
        return this.orchestrate(args);
      },
    };
  }

  /** 计划阶段：仅返回标准 JSON 计划（不包含任何代码） */
  private async runPlanPhase(params: PlanParams): Promise<PlanPhaseResult> {
    const input = params.input;
    const modelId = params.modelId;

    const userDoc = buildPluginPlanJsonPrompt(input, {
      includeAIPrompt: false,
    });

    const messages: ChatMessage[] = [
      { role: 'system', content: PLUGIN_PLAN_JSON_SYSTEM_PROMPT },
      { role: 'user', content: userDoc },
    ];

    const response = await this.aiModelService.chat({
      modelId,
      messages,
      params: { temperature: params.temperature ?? 0.2 },
    });

    const parsed = tryParseJson(response.content);
    if (!isPluginPlanJsonResult(parsed)) {
      this.logger.warn('AI 返回的计划 JSON 结构不符合预期');
      return {
        phase: 'plan',
        status: 'error',
        error: '计划阶段返回的 JSON 无法识别为 PluginPlanJsonResult',
        raw: response.content,
      };
    }

    return {
      phase: 'plan',
      status: 'ok',
      plan: parsed,
      raw: response.content,
    };
  }

  /** 生成阶段：根据计划迭代生成单文件代码（JSON-only） */
  private async runGeneratePhase(
    params: GenerateParams,
  ): Promise<GeneratePhaseResult> {
    const plan = applyNextFileOverride(params.plan, params.nextFile);
    const modelId = params.modelId;

    const userDoc = buildPluginGenJsonPromptFromPlan(plan, {
      includeAIPrompt: false,
    });

    const messages: ChatMessage[] = [
      { role: 'system', content: PLUGIN_GEN_JSON_SYSTEM_PROMPT },
      { role: 'user', content: userDoc },
    ];

    const response: AIModelResponse = await this.aiModelService.chat({
      modelId,
      messages,
      params: { temperature: params.temperature ?? 0.2 },
    });

    const parsed = tryParseJson(response.content);
    if (!isPluginGenJsonResult(parsed)) {
      this.logger.warn('AI 返回的生成 JSON 结构不符合预期');
      return {
        phase: 'generate',
        status: 'error',
        error:
          '生成阶段返回的 JSON 无法识别为 PluginGenJsonResult（缺少 file.path/code 或 plan）',
        raw: response.content,
      };
    }

    return {
      phase: 'generate',
      status: 'ok',
      result: parsed,
      raw: response.content,
    };
  }
}

/** 尝试解析 JSON，容忍前后多余文本（从首个 '{' 到最后一个 '}' 截取） */
function tryParseJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first >= 0 && last >= first) {
      const candidate = trimmed.slice(first, last + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        // fallthrough
      }
    }
    return undefined;
  }
}

/** 类型守卫：PluginPlanJsonResult */
function isPluginPlanJsonResult(v: unknown): v is PluginPlanJsonResult {
  if (!isObject(v)) return false;
  const planVal = v['plan'];
  if (!isObject(planVal)) return false;
  const files = planVal['files'];
  const nextFile = planVal['nextFile'];
  const remaining = planVal['remaining'];
  const pluginName = v['pluginName'];
  const version = v['version'];
  return (
    Array.isArray(files) &&
    typeof nextFile === 'string' &&
    Array.isArray(remaining) &&
    typeof pluginName === 'string' &&
    version === '1.0'
  );
}

function isPluginGenJsonResult(v: unknown): v is PluginGenJsonResult {
  if (!isObject(v)) return false;
  const planVal = v['plan'];
  const fileVal = v['file'];
  if (!isObject(planVal) || !isObject(fileVal)) {
    return false;
  }
  const pathVal = fileVal['path'];
  const codeVal = fileVal['code'];
  return typeof pathVal === 'string' && typeof codeVal === 'string';
}

/** 覆盖计划中的 nextFile（若提供），并同步修正 remaining 列表 */
function applyNextFileOverride(
  plan: PluginPlanJsonResult | undefined,
  nextFile: string | undefined,
): PluginPlanJsonResult {
  if (!plan) {
    throw new Error('generate 阶段需要有效的 plan');
  }
  if (!nextFile) return plan;

  const files = Array.isArray(plan.plan.files) ? plan.plan.files : [];
  const hasTarget = files.includes(nextFile);
  if (!hasTarget) return plan;

  const updatedRemaining = files.filter((f) => f !== nextFile);
  return {
    ...plan,
    plan: {
      files,
      nextFile,
      remaining: updatedRemaining,
    },
  };
}

/** 简单对象类型守卫 */
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/**
 * 类型守卫：OrchestratorParams
 * 要求至少包含 phase 与 modelId；当 phase 为 'generate' 时要求存在 plan。
 */
function isOrchestratorParams(v: unknown): v is OrchestratorParams {
  if (!isObject(v)) return false;
  const phase = v['phase'];
  const modelId = v['modelId'];
  const input = v['input'];
  if (
    (phase !== 'plan' && phase !== 'generate') ||
    typeof modelId !== 'string'
  ) {
    return false;
  }
  if (!isObject(input)) return false;
  if (phase === 'generate') {
    const planVal = v['plan'];
    return isObject(planVal);
  }
  return true;
}

/**
 * Function Call 描述迁移：
 * 该函数的工具描述已移动至 core/function-call/descriptions/plugin.orchestrate.ts。
 * 请从 'src/core/function-call/descriptions' 目录引入。
 */
