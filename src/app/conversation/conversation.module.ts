import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AICoreModule } from '@core/ai';
import { IntentAgentTriggerFunctionService } from '@core/function-call';
import { FunctionCallModule } from '@core/function-call/function-call.module';
import { AgentRuntimeModule } from '@core/agent-runtime/agent-runtime.module';
import { ConversationController } from './controllers/conversation.controller';
import { ConversationService } from './services/conversation.service';
import { ImController } from './controllers/im.controller';
import { ImGateway } from './controllers/im.gateway';
import { WebMcpGateway } from './controllers/webmcp.gateway';
import { ImSessionService } from './services/im-session.service';
import { ImMessageService } from './services/im-message.service';
import { ImContactGroupController } from './controllers/im-contact-group.controller';
import { ImContactGroupService } from './services/im-contact-group.service';
import { WebMcpSessionDataService } from './services/webmcp-session-data.service';
import { AiSessionDataService } from './services/ai-session-data.service';
import { AiSessionDataHookController } from './controllers/ai-session-data.hook-controller';
import { AiCallLogService } from './services/ai-call-log.service';
import { AiCallLogHookController } from './controllers/ai-call-log.hook-controller';
import { CurrentSessionService } from './services/current-session.service';
import { CurrentSessionHookController } from './controllers/current-session.hook-controller';
import { HookSnapshotService } from './services/hook-snapshot.service';
import { HookSnapshotController } from './controllers/hook-snapshot.controller';
import { SessionHandbookSeederService } from './services/session-handbook-seeder.service';
import { ChatSessionSmartService } from './services/chat-session-smart.service';
import { SessionLockService } from './services/session-lock.service';
import { SmartLlmGeneratorService } from './services/smart-llm-generator.service';
import { ImContactGroupEntity } from './entities/im-contact-group.entity';
import { ImContactGroupMemberEntity } from './entities/im-contact-group-member.entity';
import { ChatMessageEntity } from '@core/ai/entities/chat-message.entity';
import { ChatSessionEntity } from '@core/ai/entities/chat-session.entity';
import { ChatSessionDataEntity } from '@core/ai/entities/chat-session-data.entity';
import { ChatSessionMemberEntity } from '@core/ai/entities/chat-session-member.entity';
import { ChatSessionSmartEntity } from '@core/ai/entities/chat-session-smart.entity';
import { AIModelEntity } from '@core/ai/entities/ai-model.entity';
import { LGCheckpointEntity } from '@core/langgraph/checkpoint/entities/lg-checkpoint.entity';
import { LGWriteEntity } from '@core/langgraph/checkpoint/entities/lg-write.entity';
import { LangGraphCheckpointModule } from '@core/langgraph/checkpoint/checkpoint.module';
import { AgentExecutionEntity } from '@/app/agent/entities/agent-execution.entity';
import { AgentEntity } from '@/app/agent/entities/agent.entity';
import { PluginEntity } from '@core/plugin/entities/plugin.entity';
import { MembershipEntity } from '@/app/identity/entities/membership.entity';
import { PrincipalEntity } from '@/app/identity/entities/principal.entity';
import { UserEntity } from '@/app/identity/entities/user.entity';
import { IdentityModule } from '@/app/identity/identity.module';
import { AuthModule } from '@/core/auth/auth.module';

/**
 * @title 对话模块
 * @description 提供 IM 消息和 AI 对话能力：
 * 1) IM 会话管理（私聊/群聊/频道）
 * 2) IM 消息发送与历史
 * 3) @agent 提及和私聊 Agent 触发 AI 响应
 * 4) AI 流式对话与检查点管理
 * @keywords-cn 对话, IM, 会话, 消息, AI
 * @keywords-en conversation, im, session, message, ai
 */
@Module({
  imports: [
    AICoreModule.forRoot({
      includeFunctionServices: [IntentAgentTriggerFunctionService],
    }),
    FunctionCallModule,
    forwardRef(() => AgentRuntimeModule),
    TypeOrmModule.forFeature([
      ChatMessageEntity,
      ChatSessionEntity,
      ChatSessionDataEntity,
      ChatSessionMemberEntity,
      ChatSessionSmartEntity,
      AIModelEntity,
      LGCheckpointEntity,
      LGWriteEntity,
      AgentExecutionEntity,
      AgentEntity,
      PluginEntity,
      MembershipEntity,
      PrincipalEntity,
      UserEntity,
      ImContactGroupEntity,
      ImContactGroupMemberEntity,
    ]),
    LangGraphCheckpointModule.forRoot(),
    IdentityModule,
    AuthModule,
  ],
  controllers: [
    ConversationController,
    ImController,
    ImContactGroupController,
    HookSnapshotController,
  ],
  providers: [
    ConversationService,
    ImGateway,
    WebMcpGateway,
    ImSessionService,
    ImMessageService,
    ImContactGroupService,
    WebMcpSessionDataService,
    AiSessionDataService,
    AiSessionDataHookController,
    AiCallLogService,
    AiCallLogHookController,
    CurrentSessionService,
    CurrentSessionHookController,
    HookSnapshotService,
    SessionHandbookSeederService,
    ChatSessionSmartService,
    SessionLockService,
    SmartLlmGeneratorService,
  ],
  exports: [
    ConversationService,
    ImSessionService,
    ImMessageService,
    WebMcpGateway,
    WebMcpSessionDataService,
    AiSessionDataService,
    AiCallLogService,
    CurrentSessionService,
    SessionHandbookSeederService,
    ChatSessionSmartService,
  ],
})
export class ConversationModule {}
