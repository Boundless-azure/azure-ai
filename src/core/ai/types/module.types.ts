import { DynamicModule, Type } from '@nestjs/common';
// 新增：支持以服务类控制函数注册（更符合 Nest 的依赖注入语义）
import type { FunctionCallServiceContract } from '@core/function-call/types';
import {
  AIProvider,
  AIModelType,
  AzureOpenAIConfig,
  ModelParameters,
} from './';

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
    /** 分析窗口大小（最近N条消息） */
    analysisWindowSize?: number;
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

  /**
   * 包含的函数服务（优先级高于 includeFunction）。
   * 传入要启用的 Function-Call 服务类，例如：
   * [PluginOrchestratorService, MysqlReadonlyService, ContextFunctionService]
   */
  includeFunctionServices?: Array<Type<FunctionCallServiceContract>>;
}
export interface AICoreModuleAsyncOptions {
  imports?: Array<DynamicModule | Type<unknown>>;
  useFactory?: (
    ...args: unknown[]
  ) => Promise<AICoreModuleOptions> | AICoreModuleOptions;
  inject?: Array<string | symbol | Type<unknown>>;
  isGlobal?: boolean;
}
