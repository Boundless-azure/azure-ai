import { Module, DynamicModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AICoreModule } from '@core/ai/ai-core.module';
import { LGCheckpointEntity } from './entities/lg-checkpoint.entity';
import { LGWriteEntity } from './entities/lg-write.entity';
import { TypeOrmCheckpointSaver } from './services/typeorm-checkpoint.saver';

export type CheckpointModuleOptions = Record<string, never>;

/**
 * @title LangGraph Checkpoint 模块
 * @description 提供基于 TypeORM 的 BaseCheckpointSaver 实现与实体注册。
 * @keywords-cn LangGraph, Checkpoint, TypeORM, Saver, 模块
 * @keywords-en langgraph, checkpoint, typeorm, saver, module
 */
@Module({
  imports: [
    AICoreModule.forFeature(),
    TypeOrmModule.forFeature([LGCheckpointEntity, LGWriteEntity]),
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
        TypeOrmModule.forFeature([LGCheckpointEntity, LGWriteEntity]),
      ],
      providers: [
        TypeOrmCheckpointSaver,
        { provide: 'CHECKPOINT_OPTIONS', useValue: options },
      ],
      exports: [TypeOrmCheckpointSaver, 'CHECKPOINT_OPTIONS'],
    };
  }
}
