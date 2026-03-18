import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { Public } from '@/core/auth/decorators/public.decorator';
import { HookDebugStateService } from '../services/hook.debug-state.service';

/**
 * @title HookBus 调试控制器
 * @description 提供 SaaS 侧 HookBus 调试网关状态查询与开关接口。
 * @keywords-cn hookbus调试接口, 状态查询, 开关设置
 * @keywords-en hookbus-debug-api, state-query, toggle-set
 */
class SetHookbusDebugStateDto {
  @IsBoolean()
  enabled!: boolean;
}

@Controller('hookbus-debug')
export class HookbusDebugController {
  constructor(private readonly state: HookDebugStateService) {}

  @Public()
  @Get('state')
  getState() {
    return { ok: true, enabled: this.state.getEnabled() };
  }

  @Public()
  @Post('state')
  setState(@Body() body: SetHookbusDebugStateDto) {
    const enabled = this.state.setEnabled(body.enabled);
    return { ok: true, enabled };
  }
}
