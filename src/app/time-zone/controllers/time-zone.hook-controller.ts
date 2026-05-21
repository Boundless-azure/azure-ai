import { Injectable, Logger } from '@nestjs/common';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import type { HookResult } from '@/core/hookbus/types/hook.types';
import { TimeZoneService } from '../services/time-zone.service';
import {
  FromUtcSchema,
  LookupByIpSchema,
  NowSchema,
  ToUtcSchema,
  type FromUtcInput,
  type LookupByIpInput,
  type NowInput,
  type ToUtcInput,
} from '../types/time-zone.types';

/**
 * @title 时区 hook 注册
 * @description 把 TimeZoneService 暴露为 4 个 hook (saas.app.timeZone.{toUtc,fromUtc,now,lookupByIp})。
 *              都是工具型 hook (无业务数据副作用), 不挂 @CheckAbility — ability middleware 在 declaration.requiredAbility 为空时自动放行。
 *              主要服务场景: runner 数据触点胶水代码 / agent 处理用户的本地时间表达式时, 显式 callHook 转换, 避免假设服务器时区。
 * @keywords-cn 时区hook注册, UTC转换, IANA, 工具型hook
 * @keywords-en time-zone-hooks, utc-convert, iana, utility-hook
 */
@Injectable()
@HookController({ pluginName: 'time-zone', tags: ['time-zone', 'time'] })
export class TimeZoneHookController {
  private readonly logger = new Logger(TimeZoneHookController.name);

  constructor(private readonly timeZone: TimeZoneService) {}

  /**
   * 本地时间字符串 + IANA 时区 → UTC ISO
   * @keyword-en hook-to-utc
   */
  @HookRoute({
    hook: 'saas.app.timeZone.toUtc',
    description:
      '本地时间 + IANA 时区 → UTC ISO 字符串. 例: { localTime: "2026-05-16 09:00:00", fromTimezone: "Asia/Shanghai" } → "2026-05-16T01:00:00.000Z"',
    args: [ToUtcSchema],
    metadata: { tags: ['time-zone', 'utc', 'utility'] },
  })
  async handleToUtc(
    payload: ToUtcInput,
  ): Promise<HookResult<{ utc: string }>> {
    try {
      const { localTime, fromTimezone } = payload;
      const utc = this.timeZone.toUtc(localTime, fromTimezone);
      return { status: HookResultStatus.Success, data: { utc } };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.logger.warn(`[timeZone.toUtc] failed: ${err}`);
      return { status: HookResultStatus.Error, error: err };
    }
  }

  /**
   * UTC ISO → 指定 IANA 时区下的本地时间分量
   * @keyword-en hook-from-utc
   */
  @HookRoute({
    hook: 'saas.app.timeZone.fromUtc',
    description:
      'UTC ISO → IANA 时区本地时间. 返回 { iso (带偏移如 +08:00), year, month, day, hour, minute, second, offsetMinutes, timezone } 方便胶水代码直接拿分量, 不用再 parse 字符串',
    args: [FromUtcSchema],
    metadata: { tags: ['time-zone', 'utc', 'utility'] },
  })
  async handleFromUtc(
    payload: FromUtcInput,
  ): Promise<HookResult<ReturnType<TimeZoneService['fromUtc']>>> {
    try {
      const { utcTime, toTimezone } = payload;
      const local = this.timeZone.fromUtc(utcTime, toTimezone);
      return { status: HookResultStatus.Success, data: local };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.logger.warn(`[timeZone.fromUtc] failed: ${err}`);
      return { status: HookResultStatus.Error, error: err };
    }
  }

  /**
   * 当前时间 (UTC + 可选 IANA 本地表示)
   * @keyword-en hook-now
   */
  @HookRoute({
    hook: 'saas.app.timeZone.now',
    description:
      '当前时间. timezone 不传只回 { utc }; 传了同时回 { utc, local: {iso, year, ...} }. 强烈建议替代胶水代码 / agent 内的 new Date().toISOString() (避免假设容器时区)',
    args: [NowSchema],
    metadata: { tags: ['time-zone', 'utc', 'utility'] },
  })
  async handleNow(
    payload: NowInput,
  ): Promise<HookResult<ReturnType<TimeZoneService['now']>>> {
    try {
      const data = this.timeZone.now(payload?.timezone);
      return { status: HookResultStatus.Success, data };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.logger.warn(`[timeZone.now] failed: ${err}`);
      return { status: HookResultStatus.Error, error: err };
    }
  }

  /**
   * IP → 时区查询 (当前 stub: 返回 UTC; TODO: 接 GeoIP)
   * @keyword-en hook-lookup-by-ip
   */
  @HookRoute({
    hook: 'saas.app.timeZone.lookupByIp',
    description:
      'IP → 时区查询. 当前 stub 实现固定返回 { timezone: "UTC", source: "stub-utc-fallback" }, 调用方应能容忍 UTC fallback. 后续接 GeoIP 库不改 hook 接口',
    args: [LookupByIpSchema],
    metadata: { tags: ['time-zone', 'ip-locate', 'utility'] },
  })
  async handleLookupByIp(
    payload: LookupByIpInput,
  ): Promise<HookResult<Awaited<ReturnType<TimeZoneService['lookupByIp']>>>> {
    try {
      const data = await this.timeZone.lookupByIp(payload.ip);
      return { status: HookResultStatus.Success, data };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.logger.warn(`[timeZone.lookupByIp] failed: ${err}`);
      return { status: HookResultStatus.Error, error: err };
    }
  }
}
