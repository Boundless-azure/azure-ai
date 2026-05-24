import { tool } from 'langchain';
import z from 'zod';
import { randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';
import { AIModelService } from '@/core/ai';
import { PluginService } from '@/core/plugin';
import {
  compileCodeGenGraph,
  NODE_STEP_LABELS,
} from './dialogues/graph/code-gen.graph';
import type { CodeGenState } from './dialogues/types';
import type { ImMessageService } from '@/app/conversation/services/im-message.service';
import type { ChatMessageType } from '@core/ai/enums/chat.enums';

const logger = new Logger('CodeAgentHandle');

/**
 * 工作流上下文，在 tool 调用时由外层注入
 */
export interface WorkflowContext {
  /** 关联的 IM 会话 ID（任务完成/失败后回调） */
  sessionId: string;
  /** Agent 的 Principal ID（以 agent 身份发送回调消息） */
  agentPrincipalId: string;
  /** IM 消息服务（由 AgentRuntime 注入） */
  imMessageService: ImMessageService;
}

/**
 * @title Code Agent Handle
 * @description code-agent 提供的工具集合
 * @keywords-cn 代码智能体, 工具, LangGraph, 异步工作流, 插件生成
 * @keywords-en code-agent, tools, langgraph, async-workflow, code-generation
 */
export default class AgentHandleClass {
  #aiService: AIModelService | null = null;
  #pluginService: PluginService | null = null;
  #workflowContext: WorkflowContext | null = null;

  /**
   * 注入 AI 服务（由 AgentRuntime 调用）
   */
  handleAiServer(aiService: AIModelService) {
    this.#aiService = aiService;
    return this;
  }

  /**
   * 注入插件服务
   */
  handlePluginService(pluginService: PluginService) {
    this.#pluginService = pluginService;
    return this;
  }

  /**
   * 注入工作流上下文（会话ID、Agent PrincipalID、IM 消息服务）
   * 在每次工具调用前由 AgentRuntime 调用
   */
  withWorkflowContext(ctx: WorkflowContext) {
    this.#workflowContext = ctx;
    return this;
  }

  /**
   * 返回 code-agent 提供的所有工具
   */
  handleTool() {
    return [this.#buildOrchestrateTool()];
  }

  /**
   * 代码生成编排工具（异步工作流）
   *
   * 调用后立即返回 workflowId，工作流在后台运行
   * 完成或失败时通过关联 IM 会话发送消息
   */
  #buildOrchestrateTool() {
    const schema = z.object({
      requirement: z
        .string()
        .min(1)
        .describe('用户的代码生成需求描述，例如"帮我生成一个CRM系统"'),
      deepseekModelId: z
        .string()
        .optional()
        .describe('后端生成使用的 Deepseek 模型 ID，默认 deepseek-chat'),
      geminiModelId: z
        .string()
        .optional()
        .describe(
          '前端生成使用的 Gemini 模型 ID，默认 gemini-2.0-flash-thinking-exp',
        ),
    });

    return tool(
      (input: z.infer<typeof schema>): string => {
        if (!this.#aiService || !this.#pluginService) {
          return '❌ 服务未初始化，请先调用 handleAiServer/handlePluginService';
        }

        const workflowId = randomUUID();
        const deepseekModelId = input.deepseekModelId ?? 'deepseek-chat';
        const geminiModelId =
          input.geminiModelId ?? 'gemini-2.0-flash-thinking-exp';

        // 捕获当前上下文（工具调用时的快照）
        const ctx = this.#workflowContext;

        // 异步启动 LangGraph 工作流（fire-and-forget）
        this.#runWorkflowAsync({
          workflowId,
          requirement: input.requirement,
          deepseekModelId,
          geminiModelId,
          ctx,
        });

        // 立即返回工作流 ID
        const sessionHint = ctx?.sessionId
          ? `\n工作流完成后将在当前会话中通知您。`
          : '';
        return (
          `✅ 代码生成工作流已启动！\n` +
          `工作流 ID: \`${workflowId}\`\n` +
          `需求: ${input.requirement}\n` +
          `后端模型: ${deepseekModelId} | 前端模型: ${geminiModelId}` +
          sessionHint
        );
      },
      {
        name: 'code_gen_orchestrate',
        description:
          '根据用户需求异步启动代码生成工作流：需求分析 → 最小模块分割 → Hook接口设计 → 加载已有插件 → 并发生成前后端代码（输出到 plugins/ 目录）。' +
          '立即返回工作流ID，任务完成/失败后通过当前会话发送通知。',
        schema,
      },
    );
  }

  /**
   * 异步工作流执行（不 await，在后台运行）
   */
  #runWorkflowAsync(params: {
    workflowId: string;
    requirement: string;
    deepseekModelId: string;
    geminiModelId: string;
    ctx: WorkflowContext | null;
  }): void {
    const { workflowId, requirement, deepseekModelId, geminiModelId, ctx } =
      params;

    // 显式不 await，意图即为后台运行
    void this.#executeWorkflow({
      workflowId,
      requirement,
      deepseekModelId,
      geminiModelId,
      ctx,
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[workflow:${workflowId}] 未处理的异常: ${msg}`);
    });
  }

  async #executeWorkflow(params: {
    workflowId: string;
    requirement: string;
    deepseekModelId: string;
    geminiModelId: string;
    ctx: WorkflowContext | null;
  }): Promise<void> {
    const { workflowId, requirement, deepseekModelId, geminiModelId, ctx } =
      params;

    logger.log(`[workflow:${workflowId}] 开始执行 LangGraph 流水线`);

    const graph = compileCodeGenGraph(this.#aiService!, this.#pluginService!, {
      deepseekModelId,
      geminiModelId,
    });

    const initialState: CodeGenState = {
      userRequirement: requirement,
      sessionId: ctx?.sessionId,
    };

    try {
      // 使用 LangGraph stream 逐节点获取状态更新
      const stream = await graph.stream(initialState, {
        streamMode: 'updates',
      });

      const progressLines: string[] = [];

      for await (const update of stream) {
        // update 格式: { nodeName: Partial<CodeGenState> }
        for (const [nodeName, patch] of Object.entries(update)) {
          const p = patch as Partial<CodeGenState>;
          const label = NODE_STEP_LABELS[nodeName] ?? nodeName;
          logger.log(`[workflow:${workflowId}] ${label}`);

          const lines: string[] = [`\n${label}`];

          if (nodeName === 'splitModules' && p.modules) {
            lines.push(`已识别 ${p.modules.length} 个模块：`);
            for (const mod of p.modules) {
              const tags: string[] = [];
              if (mod.isBackend) tags.push('后端');
              if (mod.isFrontend) tags.push('前端');
              lines.push(
                `  • ${mod.name}（${tags.join('+')}）：${mod.description}`,
              );
            }
          }

          if (nodeName === 'hookDesign' && p.hookDesigns) {
            for (const hs of p.hookDesigns) {
              lines.push(
                `  • [${hs.moduleName}] Hook: ${hs.hooks.map((h) => h.name).join(', ')}`,
              );
            }
          }

          if (nodeName === 'loadPlugins' && p.existingPlugins) {
            lines.push(
              p.existingPlugins.length > 0
                ? `已找到 ${p.existingPlugins.length} 个可复用插件`
                : `未找到已有插件，将全量生成`,
            );
          }

          if (nodeName === 'generateModules' && p.generatedModules) {
            lines.push(`\n✅ 代码生成完成！生成结果：`);
            for (const gm of p.generatedModules) {
              if (gm.skipped) {
                lines.push(
                  `  ⏭️  ${gm.moduleName}（已跳过：${gm.skipReason ?? ''}）`,
                );
              } else {
                lines.push(
                  `  📁 ${gm.moduleName} → ${gm.pluginDir}（${gm.files.length} 个文件）`,
                );
                for (const f of gm.files) {
                  lines.push(`       - ${f.path}`);
                }
              }
            }
          }

          if (p.errors && p.errors.length > 0) {
            for (const err of p.errors) {
              lines.push(`  ⚠️  ${err}`);
            }
          }

          progressLines.push(...lines);
        }
      }

      // 工作流成功 — 通过 IM 会话发送完成通知
      const successMsg =
        `🎉 **代码生成工作流已完成**\n` +
        `工作流 ID: \`${workflowId}\`\n\n` +
        progressLines.join('\n') +
        `\n\n请在 \`plugins/\` 目录查看生成的模块代码。`;

      await this.#sendSessionMessage(ctx, successMsg, workflowId, 'success');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`[workflow:${workflowId}] 执行失败: ${errorMsg}`);

      // 工作流失败 — 也发送通知
      const failureMsg =
        `❌ **代码生成工作流失败**\n` +
        `工作流 ID: \`${workflowId}\`\n` +
        `错误信息: ${errorMsg}`;

      await this.#sendSessionMessage(ctx, failureMsg, workflowId, 'failure');
    }
  }

  /**
   * 通过 IM 会话发送 Agent 身份消息
   */
  async #sendSessionMessage(
    ctx: WorkflowContext | null,
    content: string,
    workflowId: string,
    type: 'success' | 'failure',
  ): Promise<void> {
    if (!ctx) {
      logger.warn(
        `[workflow:${workflowId}] 无 WorkflowContext，跳过 IM 消息发送（${type}）`,
      );
      return;
    }

    try {
      await ctx.imMessageService.sendMessage(
        ctx.agentPrincipalId,
        {
          sessionId: ctx.sessionId,
          content,
          messageType: 'text' as unknown as ChatMessageType,
        },
        { role: 'assistant', skipAgentTrigger: true },
      );
      logger.log(
        `[workflow:${workflowId}] 已发送 ${type} 通知到会话 ${ctx.sessionId}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[workflow:${workflowId}] 发送 IM 消息失败: ${msg}`);
    }
  }
}
