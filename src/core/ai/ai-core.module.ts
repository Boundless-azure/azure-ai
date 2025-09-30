import { Module, DynamicModule, Type } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ContextService } from './services/context.service';
import { AIModelService } from './services/ai-model.service';
import {
  AIModelEntity,
  PromptTemplateEntity,
  ChatSessionEntity,
} from './entities';
import {
  AIProvider,
  AIModelType,
  AzureOpenAIConfig,
  ModelParameters,
} from './types';

/**
 * AI核心模块配置接口
 */
export interface AICoreModuleOptions {
  /**
   * 是否为全局模块
   */
  isGlobal?: boolean;

  /**
   * 数据库配置
   */
  database?: {
    type?: 'sqlite' | 'mysql' | 'postgres';
    database?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    synchronize?: boolean;
  };

  /**
   * 上下文服务配置
   */
  context?: {
    maxMessages?: number;
    maxContextAge?: number;
    cleanupInterval?: number;
  };

  /**
   * 默认AI模型配置
   */
  defaultModels?: Array<{
    name: string;
    displayName: string;
    provider: AIProvider;
    type: AIModelType;
    apiKey: string;
    baseURL?: string;
    azureConfig?: AzureOpenAIConfig;
    defaultParams?: ModelParameters;
    description?: string;
  }>;
}

export interface AICoreModuleAsyncOptions {
  imports?: Array<DynamicModule | Type<unknown>>;
  useFactory?: (
    ...args: unknown[]
  ) => Promise<AICoreModuleOptions> | AICoreModuleOptions;
  inject?: Array<string | symbol | Type<unknown>>;
  isGlobal?: boolean;
}

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
    ]),
  ],
  providers: [ContextService, AIModelService],
  exports: [ContextService, AIModelService, TypeOrmModule],
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
