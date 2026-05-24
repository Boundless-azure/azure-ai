import { forwardRef, Module } from '@nestjs/common';
import { AICoreModule } from '@core/ai/ai-core.module';
import { RunnerModule } from '@/app/runner/runner.module';
import { ConversationModule } from '@/app/conversation/conversation.module';
import { AgentRuntimeService } from './services/agent-runtime.service';
import { AgentLoaderService } from './services/agent-loader.service';
import { AgentRuntimeController } from './controller/agent-runtime.controller';

/**
 * @title Core 模块：AgentRuntimeModule
 * @description 提供基于目录的 Agent 动态加载与对话接入能力，供意图分析触发后在当前对话层实现 Agent 加入。
 *              依赖 RunnerModule 注入 RunnerHookRpcService, 让 call_hook 工具能远程派发到 Runner。
 *              call_hook 成功记录由 ConversationModule 的 AiCallLogService 持久化, sessionData (handbook/directive/preference) 改由 saas.app.conversation.initTip 的 suggestions 推过去 (LLM 自行 sessionData.get 取真内容),
 *              本轮工具判定写入 CurrentSessionService。
 * @keywords-cn 核心模块, 动态加载, Agent, 对话接入, Runner Hook RPC, 调用历史, init-tip 推荐, 工具判定
 * @keywords-en core-module, dynamic-loader, agent, dialogue-attach, runner-hook-rpc, call-history, init-tip-suggestions, tool-guard
 */
@Module({
  imports: [
    AICoreModule.forFeature(),
    forwardRef(() => RunnerModule),
    forwardRef(() => ConversationModule),
  ],
  providers: [AgentRuntimeService, AgentLoaderService],
  controllers: [AgentRuntimeController],
  exports: [AgentRuntimeService],
})
export class AgentRuntimeModule {}
