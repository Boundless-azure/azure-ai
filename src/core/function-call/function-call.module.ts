import { Module } from '@nestjs/common';
import { PluginOrchestratorService } from './services/plugin_orchestrate.function-service';
import { ContextFunctionService } from './services/context_window_keyword.function-service';
import { MysqlReadonlyService } from './services/db_mysql_select.function-service';

/**
 * @title Function Call 专用模块
 * @module core/function-call
 * @desc 为主对话提供函数调用相关的服务与描述，集中管理、与业务模块解耦。
 */
@Module({
  imports: [],
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
