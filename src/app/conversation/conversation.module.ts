import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AICoreModule } from '@core/ai';
import { IntentAgentTriggerFunctionService } from '@core/function-call';
import { FunctionCallModule } from '@core/function-call/function-call.module';
import { ConversationController } from './controllers/conversation.controller';
import { ConversationService } from './services/conversation.service';
import { ConversationGroupController } from './controllers/conversation-group.controller';
import { ChatDayGroupEntity } from '@core/ai/entities/chat-day-group.entity';
import { ChatConversationGroupEntity } from '@core/ai/entities/chat-conversation-group.entity';
import { ChatMessageEntity } from '@core/ai/entities/chat-message.entity';
import { ChatSessionEntity } from '@core/ai/entities/chat-session.entity';
import { RoundSummaryEntity } from '@core/ai/entities/round-summary.entity';
import { LGCheckpointEntity } from '@core/langgraph/checkpoint/entities/lg-checkpoint.entity';
import { LGWriteEntity } from '@core/langgraph/checkpoint/entities/lg-write.entity';
import { LangGraphCheckpointModule } from '@core/langgraph/checkpoint/checkpoint.module';
import { ConversationGateway } from './controllers/conversation.gateway';
import { AgentExecutionEntity } from '@/app/agent/entities/agent-execution.entity';
/**
 * @title 外部对话模块
 * @desc 提供完整的 AI 对话接口：
 * 1) 集成 core/ai 的 AIModelService 和 ContextService
 * 2) 支持流式和非流式对话
 * 3) 自动管理对话上下文和历史记录
 * 4) 集成现有的 function-call 能力（插件生成、数据库查询、上下文检索）
 */
@Module({
  imports: [
    AICoreModule.forRoot({
      // 仅启用指定的 Function-Call 服务；可根据需要增减：
      // 例如启用插件编排器/上下文窗口/MySQL只读查询：
      // includeFunctionServices: [PluginOrchestratorService, ContextFunctionService, MysqlReadonlyService],
      includeFunctionServices: [IntentAgentTriggerFunctionService],
    }), // 导入 AI 核心模块
    FunctionCallModule, // 导入 function-call 模块
    TypeOrmModule.forFeature([
      ChatMessageEntity,
      ChatSessionEntity,
      RoundSummaryEntity,
      ChatDayGroupEntity,
      ChatConversationGroupEntity,
      LGCheckpointEntity,
      LGWriteEntity,
      AgentExecutionEntity,
    ]),
    LangGraphCheckpointModule.forRoot(),
  ],
  controllers: [ConversationController, ConversationGroupController],
  providers: [ConversationService, ConversationGateway],
  exports: [ConversationService],
})
export class ConversationModule {}
