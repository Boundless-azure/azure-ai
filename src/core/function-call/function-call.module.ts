import { Module } from '@nestjs/common';
import { AICoreModule } from '../ai/ai-core.module';
import { PluginOrchestratorService } from './services/plugin.orchestrator.service';
import { ContextFunctionService } from './services/context.function.service';
import { MysqlReadonlyService } from './services/mysql.readonly.service';

/**
 * @title Function Call 专用模块
 * @module core/function-call
 * @desc 为主对话提供函数调用相关的服务与描述，集中管理、与业务模块解耦。
 */
@Module({
  imports: [AICoreModule.forFeature()],
  providers: [
    PluginOrchestratorService,
    ContextFunctionService,
    MysqlReadonlyService,
  ],
  exports: [
    PluginOrchestratorService,
    ContextFunctionService,
    MysqlReadonlyService,
  ],
})
export class FunctionCallModule {}
