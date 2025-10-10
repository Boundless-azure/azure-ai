import { DynamicModule, Module } from '@nestjs/common';
import { PromptService } from './services/prompt.service';
import { PromptRenderer } from './services/prompt.renderer';

export interface PromptModuleOptions {
  isGlobal?: boolean;
  helpers?: Record<string, (...args: any[]) => any>;
}

@Module({
  providers: [PromptService, PromptRenderer],
  exports: [PromptService, PromptRenderer],
})
export class PromptModule {
  static forRoot(options?: PromptModuleOptions): DynamicModule {
    return {
      module: PromptModule,
      global: options?.isGlobal ?? false,
      providers: [
        PromptService,
        PromptRenderer,
        {
          provide: 'PROMPT_HELPERS',
          useValue: options?.helpers ?? {},
        },
      ],
      exports: [PromptService, PromptRenderer],
    };
  }
}
