import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AICoreModule } from '@core/ai';
import { IntentAgentTriggerFunctionService } from '@core/function-call';
import { FunctionCallModule } from '@core/function-call/function-call.module';
import { AgentRuntimeModule } from '@core/agent-runtime/agent-runtime.module';
import { ConversationController } from './controllers/conversation.controller';
import { ConversationService } from './services/conversation.service';
import { ImController } from './controllers/im.controller';
import { ImGateway } from './controllers/im.gateway';
import { ImSessionService } from './services/im-session.service';
import { ImMessageService } from './services/im-message.service';
import { ImContactGroupController } from './controllers/im-contact-group.controller';
import { ImContactGroupService } from './services/im-contact-group.service';
import { ImContactGroupEntity } from './entities/im-contact-group.entity';
import { ImContactGroupMemberEntity } from './entities/im-contact-group-member.entity';
import { ChatMessageEntity } from '@core/ai/entities/chat-message.entity';
import { ChatSessionEntity } from '@core/ai/entities/chat-session.entity';
import { ChatSessionMemberEntity } from '@core/ai/entities/chat-session-member.entity';
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
    AgentRuntimeModule,
    TypeOrmModule.forFeature([
      ChatMessageEntity,
      ChatSessionEntity,
      ChatSessionMemberEntity,
      ChatSessionMemberEntity,
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
  controllers: [ConversationController, ImController, ImContactGroupController],
  providers: [
    ConversationService,
    ImGateway,
    ImSessionService,
    ImMessageService,
    ImContactGroupService,
  ],
  exports: [ConversationService, ImSessionService, ImMessageService],
})
export class ConversationModule {}
