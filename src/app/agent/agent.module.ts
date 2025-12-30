import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from './entities/agent.entity';
import { AgentExecutionEntity } from './entities/agent-execution.entity';
import { AgentService } from './services/agent.service';
import { AgentExecutionService } from './services/execution.service';
import { AgentController } from './controllers/agent.controller';
import { AgentExecutionController } from './controllers/execution.controller';
import { AgentCache } from './cache/agent.cache';
import { AICoreModule } from '@core/ai/ai-core.module';

/**
 * @title Agent 模块
 * @description 提供 Agent 与执行记录的查改删接口；集成 TypeORM 与可选 Redis 缓存。
 * @keywords-cn Agent模块, 执行Agent模块, TypeORM, Redis缓存
 * @keywords-en agent-module, execution-module, typeorm, redis-cache
 */
@Module({
  imports: [
    AICoreModule.forFeature(),
    TypeOrmModule.forFeature([AgentEntity, AgentExecutionEntity]),
  ],
  providers: [AgentService, AgentExecutionService, AgentCache],
  controllers: [AgentController, AgentExecutionController],
  exports: [AgentService, AgentExecutionService],
})
export class AgentModule {}
