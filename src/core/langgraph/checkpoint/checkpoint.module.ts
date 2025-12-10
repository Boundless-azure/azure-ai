import { Module, DynamicModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AICoreModule } from '@core/ai/ai-core.module';
import { LGCheckpointEntity } from './entities/lg-checkpoint.entity';
import { LGWriteEntity } from './entities/lg-write.entity';
import { TypeOrmCheckpointSaver } from './services/typeorm-checkpoint.saver';
import { RoundSummaryEntity } from '@core/ai/entities/round-summary.entity';
import type { ChatMessage } from '@core/ai/types';

export interface SummaryModelHandle {
  chat(messages: ChatMessage[]): Promise<string>;
}

export interface CheckpointModuleOptions {
  summary?: boolean;
  summaryInterval?: number;
  insertSummaryAsSystemMessage?: boolean;
  summaryModel?:
    | SummaryModelHandle
    | ((messages: ChatMessage[]) => Promise<string>);
}

/**
 * @title LangGraph Checkpoint 模块
 * @description 提供基于 TypeORM 的 BaseCheckpointSaver 实现与实体注册。
 * @keywords-cn LangGraph, Checkpoint, TypeORM, Saver, 模块
 * @keywords-en langgraph, checkpoint, typeorm, saver, module
 */
@Module({
  imports: [
    AICoreModule.forFeature(),
    TypeOrmModule.forFeature([
      LGCheckpointEntity,
      LGWriteEntity,
      RoundSummaryEntity,
    ]),
  ],
  providers: [
    TypeOrmCheckpointSaver,
    { provide: 'CHECKPOINT_OPTIONS', useValue: {} },
  ],
  exports: [TypeOrmCheckpointSaver, 'CHECKPOINT_OPTIONS'],
})
export class LangGraphCheckpointModule {
  static forRoot(options: CheckpointModuleOptions = {}): DynamicModule {
    return {
      module: LangGraphCheckpointModule,
      imports: [
        AICoreModule.forFeature(),
        TypeOrmModule.forFeature([
          LGCheckpointEntity,
          LGWriteEntity,
          RoundSummaryEntity,
        ]),
      ],
      providers: [
        TypeOrmCheckpointSaver,
        { provide: 'CHECKPOINT_OPTIONS', useValue: options },
      ],
      exports: [TypeOrmCheckpointSaver, 'CHECKPOINT_OPTIONS'],
    };
  }
}
