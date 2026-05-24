import { Module } from '@nestjs/common';
import { TimeZoneService } from './services/time-zone.service';
import { TimeZoneHookController } from './controllers/time-zone.hook-controller';

/**
 * @title 时区模块
 * @description 提供 saas.app.timeZone.* 系列 hook (toUtc / fromUtc / now / lookupByIp).
 *              支撑 "runner 内部时间统一 UTC, 业务需要本地时间显式转换" 这条设计原则。
 *              NestJS 启动期 hook-controller 扫描会自动把 @HookRoute 方法挂到 hookBus, 无需手动 register.
 * @keywords-cn 时区模块, 时间处理, UTC转换
 * @keywords-en time-zone-module, time-handling, utc-convert
 */
@Module({
  providers: [TimeZoneService, TimeZoneHookController],
  exports: [TimeZoneService],
})
export class TimeZoneModule {}
