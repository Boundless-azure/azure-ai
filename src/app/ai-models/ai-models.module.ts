import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AIModelEntity } from './entities/ai-model.entity';
import { AiModelsService } from './services/ai-models.service';
import { AiModelsController } from './controllers/ai-models.controller';

/**
 * @title AI模型模块
 * @description 提供 AI 模型配置的管理模块。
 * @keywords-cn AI模型模块, 模型管理, 提供商配置
 * @keywords-en ai-models-module, model-management, provider-config
 */
@Module({
  imports: [TypeOrmModule.forFeature([AIModelEntity])],
  controllers: [AiModelsController],
  providers: [AiModelsService],
})
export class AiModelsModule {}
