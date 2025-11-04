import { Module, DynamicModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ContextService } from './services/context.service';
import { AIModelService } from './services/ai-model.service';
import { MessageKeywordsService } from './services/message.keywords.service';
import {
  AIModelEntity,
  PromptTemplateEntity,
  ChatSessionEntity,
  ChatMessageEntity,
} from './entities';
import {
  AICoreModuleAsyncOptions,
  AICoreModuleOptions,
} from './types/module.types';

/**
 * AI核心模块
 * 提供AI模型管理、上下文处理、LangChain集成等功能
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      AIModelEntity,
      PromptTemplateEntity,
      ChatSessionEntity,
      ChatMessageEntity,
    ]),
  ],
  providers: [
    {
      provide: 'AI_CORE_OPTIONS',
      useValue: {},
    },
    ContextService,
    AIModelService,
    MessageKeywordsService,
  ],
  exports: [
    ContextService,
    AIModelService,
    MessageKeywordsService,
    TypeOrmModule,
  ],
})
export class AICoreModule {
  /**
   * 同步注册模块
   */
  static forRoot(options: AICoreModuleOptions = {}): DynamicModule {
    return {
      module: AICoreModule,
      global: options.isGlobal ?? false,
      providers: [
        {
          provide: 'AI_CORE_OPTIONS',
          useValue: options,
        },
      ],
    };
  }

  /**
   * 异步注册模块
   */
  static forRootAsync(options: AICoreModuleAsyncOptions): DynamicModule {
    return {
      module: AICoreModule,
      global: options.isGlobal ?? false,
      imports: [...(options.imports || [])],
      providers: [
        {
          provide: 'AI_CORE_OPTIONS',
          useFactory: options.useFactory || (() => ({}) as AICoreModuleOptions),
          inject: options.inject || [],
        },
      ],
    };
  }

  /**
   * 功能模块注册（不包含数据库配置）
   */
  static forFeature(): DynamicModule {
    return {
      module: AICoreModule,
    };
  }
}

/**
 * AI核心模块的便捷导出
 */
export * from './types';
export * from './entities';
export * from './services/context.service';
export * from './services/ai-model.service';
