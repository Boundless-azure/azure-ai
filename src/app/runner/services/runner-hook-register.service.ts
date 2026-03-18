import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { HookBusService } from '@/core/hookbus/services/hook.bus.service';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';

/**
 * @title Runner Hook 注册服务
 * @description 启动时为现有功能块注册基础 Hook 占位处理器。
 * @keywords-cn Hook注册, 功能块, 启动初始化
 * @keywords-en hook-registration, feature-block, startup-init
 */
@Injectable()
export class RunnerHookRegisterService implements OnModuleInit {
  constructor(@Optional() private readonly hookBus?: HookBusService) {}

  onModuleInit(): void {
    if (!this.hookBus) return;
    const modules = [
      'agent',
      'conversation',
      'identity',
      'resource',
      'todo',
      'plugin',
      'ai_models',
      'runner',
    ];
    for (const moduleName of modules) {
      this.hookBus.register(
        `on${this.toPascal(moduleName)}RunnerBootstrap`,
        () => ({ status: HookResultStatus.Success, data: { moduleName } }),
        { pluginName: 'runner', tags: ['bootstrap', moduleName] },
      );
    }
  }

  private toPascal(input: string): string {
    const parts = input.split('_').filter((item) => item.length > 0);
    return parts
      .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
      .join('');
  }
}
