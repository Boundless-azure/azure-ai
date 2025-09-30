import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { TipService } from './tip.service';
import { TipGeneratorService } from './tip.generator';
import { TipController } from './tip.controller';
import type { TipModuleOptions } from './tip.types';
import { TIP_OPTIONS } from './tip.tokens';
import * as path from 'path';
import { AICoreModule } from '../ai/ai-core.module';

@Module({})
export class TipModule {
  static forRoot(options: TipModuleOptions = {}): DynamicModule {
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
    return TipModule.forRoot();
  }
}
