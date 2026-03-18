import { Injectable } from '@nestjs/common';

/**
 * @title HookBus 调试开关服务
 * @description 管理 SaaS 侧 HookBus 调试网关启停状态。
 * @keywords-cn 调试开关, 网关状态, hookbus-debug
 * @keywords-en debug-toggle, gateway-state, hookbus-debug
 */
@Injectable()
export class HookDebugStateService {
  private enabled = false;

  getEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(next: boolean): boolean {
    this.enabled = next;
    return this.enabled;
  }
}
