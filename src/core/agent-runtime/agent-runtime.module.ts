import { forwardRef, Module } from '@nestjs/common';
import { AICoreModule } from '@core/ai/ai-core.module';
import { RunnerModule } from '@/app/runner/runner.module';
import { AgentRuntimeService } from './services/agent-runtime.service';
import { AgentLoaderService } from './services/agent-loader.service';
import { SessionCallTrackerService } from './services/session-call-tracker.service';
import { SessionSaveLlmService } from './services/session-save-llm.service';
import { AgentRuntimeController } from './controller/agent-runtime.controller';

/**
 * @title Core 模块：AgentRuntimeModule
 * @description 提供基于目录的 Agent 动态加载与对话接入能力，供意图分析触发后在当前对话层实现 Agent 加入。
 *              依赖 RunnerModule 注入 RunnerHookRpcService, 让 call_hook 工具能远程派发到 Runner。
 *              SessionCallTrackerService :: 内存追踪每个 sessionId 的 call_hook 记录, 硬匹配触发沉淀
 *              SessionSaveLlmService :: 独立 LLM 决策 sessionData.save (用同 agent model, 不阻塞主对话)
 * @keywords-cn 核心模块, 动态加载, Agent, 对话接入, Runner Hook RPC, 调用追踪, 沉淀LLM
 * @keywords-en core-module, dynamic-loader, agent, dialogue-attach, runner-hook-rpc, call-tracker, save-llm
 */
@Module({
  imports: [AICoreModule.forFeature(), forwardRef(() => RunnerModule)],
  providers: [
    AgentRuntimeService,
    AgentLoaderService,
    SessionCallTrackerService,
    SessionSaveLlmService,
  ],
  controllers: [AgentRuntimeController],
  exports: [AgentRuntimeService],
})
export class AgentRuntimeModule {}
