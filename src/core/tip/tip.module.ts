/**
 * TipModule：封装 TipService 与 TipGeneratorService，并暴露控制器端点。
 *
 * 使用：
 * - TipModule.forRoot(options?)：在根模块中注册，传入 TipModuleOptions 定制扫描与深度
 * - TipModule.forFeature()：在特性模块中按默认配置快速引入
 *
 * 提示：
 * - 提供 TIP_OPTIONS（注入令牌），避免模块与服务之间的循环依赖
 * - 默认 rootDir=src/core，excludePatterns 包含 dist/node_modules
 */
import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { TipService } from './services/tip.service';
import { TipGeneratorService } from './services/tip.generator';
import { TipController } from './controllers/tip.controller';
import type { TipModuleOptions } from './types';
import { TIP_OPTIONS } from './types/tokens';
import * as path from 'path';
import { AICoreModule } from '../ai/ai-core.module';

@Module({})
export class TipModule {
  static forRoot(options: TipModuleOptions = {}): DynamicModule {
    // 计算默认根目录，兼容工作目录差异
    const rootDir =
      options.rootDir ?? path.resolve(process.cwd(), 'src', 'core');
    const providedOptions: TipModuleOptions = {
      rootDir,
      includePatterns: options.includePatterns ?? ['**/*.tip'],
      excludePatterns: options.excludePatterns ?? [
        '**/dist/**',
        '**/node_modules/**',
      ],
      maxDepth: options.maxDepth ?? 5,
    };

    return {
      module: TipModule,
      imports: [AICoreModule.forFeature()],
      controllers: [TipController],
      providers: [
        { provide: TIP_OPTIONS, useValue: providedOptions },
        TipService,
        TipGeneratorService,
      ],
      exports: [TipService, TipGeneratorService],
    };
  }

  static forFeature(): DynamicModule {
    // 以默认配置注册，适合特性模块快速使用
    return TipModule.forRoot();
  }
}
