import { Module } from '@nestjs/common';
import { AICoreModule } from '@core/ai/ai-core.module';
import { AgentRuntimeService } from './services/agent-runtime.service';
import { AgentLoaderService } from './services/agent-loader.service';
import { AgentRuntimeController } from './controller/agent-runtime.controller';

/**
 * @title Core 模块：AgentRuntimeModule
 * @description 提供基于目录的 Agent 动态加载与对话接入能力，供意图分析触发后在当前对话层实现 Agent 加入。
 * @keywords-cn 核心模块, 动态加载, Agent, 对话接入
 * @keywords-en core-module, dynamic-loader, agent, dialogue-attach
 */
@Module({
  imports: [AICoreModule.forFeature()],
  providers: [AgentRuntimeService, AgentLoaderService],
  controllers: [AgentRuntimeController],
  exports: [AgentRuntimeService],
})
export class AgentRuntimeModule {}
