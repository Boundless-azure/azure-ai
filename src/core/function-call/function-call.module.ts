import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AICoreModule } from '@core/ai/ai-core.module';
import { PluginOrchestratorService } from './services/plugin_orchestrate.function-service';
import { ContextFunctionService } from './services/context_window_keyword.function-service';
import { MysqlReadonlyService } from './services/db_mysql_select.function-service';
import { MongoReadonlyService } from './services/db_mongo_find.function-service';
import { WebMcpFunctionService } from './services/webmcp_get.function-service';
import { WebMcpOperationFunctionService } from './services/webmcp_op.function-service';
import { WebMcpModule } from '@/app/webmcp/webmcp.module';
import { IntentAgentTriggerFunctionService } from './services/intent_agent_trigger.function-service';
import { AgentEntity } from '@/app/agent/entities/agent.entity';
import { AgentExecutionEntity } from '@/app/agent/entities/agent-execution.entity';
import { ChatMessageEntity } from '@core/ai/entities/chat-message.entity';
import { ChatSessionEntity } from '@core/ai/entities/chat-session.entity';

/**
 * @title Function Call 专用模块
 * @module core/function-call
 * @desc 为主对话提供函数调用相关的服务与描述，集中管理、与业务模块解耦。
 */
@Module({
  imports: [
    WebMcpModule,
    AICoreModule.forFeature(),
    TypeOrmModule.forFeature([
      AgentEntity,
      AgentExecutionEntity,
      ChatMessageEntity,
      ChatSessionEntity,
    ]),
  ],
  providers: [
    PluginOrchestratorService,
    ContextFunctionService,
    MysqlReadonlyService,
    MongoReadonlyService,
    WebMcpFunctionService,
    WebMcpOperationFunctionService,
    IntentAgentTriggerFunctionService,
  ],
  exports: [
    PluginOrchestratorService,
    ContextFunctionService,
    MysqlReadonlyService,
    MongoReadonlyService,
    WebMcpFunctionService,
    WebMcpOperationFunctionService,
    IntentAgentTriggerFunctionService,
  ],
})
export class FunctionCallModule {}
