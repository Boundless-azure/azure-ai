import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PluginEntity } from './plugin.entity';
import { PluginService } from './plugin.service';
import { PluginKeywordsService } from './plugin.keywords.service';
import { PluginController } from './plugin.controller';
import { AICoreModule } from '../ai/ai-core.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PluginEntity]),
    AICoreModule.forFeature(),
  ],
  providers: [PluginService, PluginKeywordsService],
  controllers: [PluginController],
  exports: [PluginService],
})
export class PluginModule {}
