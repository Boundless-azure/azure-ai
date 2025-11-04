import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PluginEntity } from './entities/plugin.entity';
import { PluginKeywordsService } from './services/plugin.keywords.service';
import { AICoreModule } from '../ai/ai-core.module';

/**
 * 插件模块（NestJS Module）
 * - 管理插件的实体、服务与控制器
 * - 依赖 AICoreModule，以便在录入插件时生成关键词
 *
 * 导出：
 * - PluginService：供其他模块使用插件相关的增删改查与注册能力
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PluginEntity]),
    AICoreModule.forFeature(),
  ],
  providers: [PluginKeywordsService],
  // 已移除 PluginController 与 PluginService
  exports: [],
})
export class PluginModule {}
