import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AICoreModule } from '@core/ai';
import { FunctionCallModule } from '@core/function-call/function-call.module';
import { ConversationController } from './controllers/conversation.controller';
import { ConversationService } from './services/conversation.service';
import { ConversationSegmentService } from './services/segment.service';
import { SegmentController } from './controllers/segment.controller';
import { ChatSegmentEntity } from './entities/chat-segment.entity';
import { ChatMessageEntity } from '@core/ai/entities/chat-message.entity';
// 改为按服务类控制启用的函数调用
import { MysqlReadonlyService } from '@core/function-call';
import { LangGraphCheckpointModule } from '@core/langgraph/checkpoint/checkpoint.module';
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
      includeFunctionServices: [MysqlReadonlyService],
    }), // 导入 AI 核心模块
    FunctionCallModule, // 导入 function-call 模块
    TypeOrmModule.forFeature([ChatSegmentEntity, ChatMessageEntity]),
    LangGraphCheckpointModule.forRoot(),
  ],
  controllers: [ConversationController, SegmentController],
  providers: [ConversationService, ConversationSegmentService],
  exports: [ConversationService, ConversationSegmentService],
})
export class ConversationModule {}
