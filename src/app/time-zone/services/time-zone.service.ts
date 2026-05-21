import { Injectable, Logger } from '@nestjs/common';
import type {
  LocalTimeParts,
  LookupByIpResult,
} from '../types/time-zone.types';

/**
 * @title 时区服务
 * @description 基于 Node 内置 Intl.DateTimeFormat 做 UTC↔IANA 时区转换 (零依赖)。
 *              IP → 时区当前是 stub 实现 (兜底 UTC), 接 GeoIP 库 (geoip-lite / ip2location-lite) 或外部 API (ipapi.co 等) 是后续 TODO。
 *              本服务专门支撑 "runner 内部时间统一 UTC, 业务需要本地时间时显式转换" 这条设计原则。
 * @keywords-cn 时区服务, UTC转换, IANA, Intl, IP定位
 * @keywords-en time-zone-service, utc-convert, iana, intl, ip-locate
 */
@Injectable()
export class TimeZoneService {
  private readonly logger = new Logger(TimeZoneService.name);

  /**
   * 把本地时间字符串 + IANA 时区 → UTC ISO
   *  - localTime 不含时区信息时, 视为 fromTimezone 下的本地时间
   *  - 算法: 计算 fromTimezone 在该本地时刻的 UTC 偏移分钟数, 反推 UTC 毫秒, 输出 ISO
   * @keyword-en local-to-utc
   */
  toUtc(localTime: string, fromTimezone: string): string {
    // 先按 UTC 解析得到一个"伪 UTC"时间戳, 再用 fromTimezone 的实际偏移修正
    const naiveMs = this.parseNaiveMs(localTime);
    const offsetMin = this.getOffsetMinutes(naiveMs, fromTimezone);
    const utcMs = naiveMs - offsetMin * 60_000;
    return new Date(utcMs).toISOString();
  }

  /**
   * UTC ISO → 指定时区的本地时间分量
   *  - 输出 ISO 含时区偏移 (e.g. "2026-05-16T09:00:00+08:00")
   *  - 分量字段 (year/month/...) 方便胶水代码直接拿
   * @keyword-en utc-to-local
   */
  fromUtc(utcTime: string, toTimezone: string): LocalTimeParts {
    const utcMs = Date.parse(utcTime);
    if (Number.isNaN(utcMs)) {
      throw new Error(`invalid utcTime: ${utcTime}`);
    }
    return this.composeLocalParts(utcMs, toTimezone);
  }

  /**
   * 当前时间; timezone 不传只返回 UTC ISO
   * @keyword-en now
   */
  now(timezone?: string): { utc: string; local?: LocalTimeParts } {
    const utcMs = Date.now();
    const utc = new Date(utcMs).toISOString();
    if (!timezone) return { utc };
    return { utc, local: this.composeLocalParts(utcMs, timezone) };
  }

  /**
   * IP 查询时区 (stub 实现)
   *  - 当前固定返回 UTC + source='stub-utc-fallback', 调用方应能容忍 'UTC' fallback
   *  - 接入真实数据源 (geoip-lite / 外部 API) 是后续 TODO; 接入时只改本方法实现, hook 接口不变
   * @keyword-en lookup-by-ip
   */
  async lookupByIp(ip: string): Promise<LookupByIpResult> {
    // TODO: 接入 GeoIP 库 (geoip-lite / ip2location-lite) 或外部 API
    //   优先: 离线库 + 部署期更新; 避免对外部 API 的运行时依赖
    this.logger.debug(`[timeZone.lookupByIp] stub fallback to UTC, ip=${ip}`);
    return {
      timezone: 'UTC',
      country: null,
      region: null,
      source: 'stub-utc-fallback',
    };
  }

  /**
   * 把"无时区"时间字符串解析成毫秒, 按 UTC 解读 (产出"伪 UTC ms")
   *  - "2026-05-16 09:00:00" → 当作 2026-05-16T09:00:00Z 解析
   *  - 已含时区偏移的字符串 (含 Z / +08:00) 直接 Date.parse 即可
   * @keyword-en parse-naive-ms
   */
  private parseNaiveMs(timeStr: string): number {
    // 已有时区标识符则按标准解析
    if (/Z$|[+-]\d{2}:?\d{2}$/.test(timeStr)) {
      const ms = Date.parse(timeStr);
      if (Number.isNaN(ms)) throw new Error(`invalid time: ${timeStr}`);
      return ms;
    }
    // 没时区标识, 替换空格为 T, 加 Z 当 UTC 解析
    const normalized = timeStr.includes('T')
      ? `${timeStr}Z`
      : `${timeStr.replace(' ', 'T')}Z`;
    const ms = Date.parse(normalized);
    if (Number.isNaN(ms)) throw new Error(`invalid time: ${timeStr}`);
    return ms;
  }

  /**
   * 拿指定 UTC 毫秒数在 timezone 下的偏移分钟数 (东半球为正)
   *  - 用 Intl.DateTimeFormat formatToParts 拿到该时刻在 timezone 下的"墙上时间", 反推偏移
   * @keyword-en get-offset-minutes
   */
  private getOffsetMinutes(utcMs: number, timezone: string): number {
    const parts = this.getDateParts(utcMs, timezone);
    // 用 Date.UTC 把"墙上时间"按 UTC 重新组装, 跟原 utcMs 差就是偏移
    const wallUtcMs = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    return Math.round((wallUtcMs - utcMs) / 60_000);
  }

  /**
   * 拿 utcMs 在 timezone 下的年月日时分秒
   * @keyword-en get-date-parts
   */
  private getDateParts(
    utcMs: number,
    timezone: string,
  ): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  } {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const map: Record<string, number> = {};
    for (const p of fmt.formatToParts(new Date(utcMs))) {
      if (p.type !== 'literal') map[p.type] = parseInt(p.value, 10);
    }
    // Intl 在跨日界时可能返回 24:00:00, 归一到 00:00:00
    if (map.hour === 24) map.hour = 0;
    return {
      year: map.year ?? 0,
      month: map.month ?? 0,
      day: map.day ?? 0,
      hour: map.hour ?? 0,
      minute: map.minute ?? 0,
      second: map.second ?? 0,
    };
  }

  /**
   * 组装 LocalTimeParts (含 ISO 带偏移)
   * @keyword-en compose-local-parts
   */
  private composeLocalParts(utcMs: number, timezone: string): LocalTimeParts {
    const parts = this.getDateParts(utcMs, timezone);
    const offsetMin = this.getOffsetMinutes(utcMs, timezone);
    const sign = offsetMin >= 0 ? '+' : '-';
    const absMin = Math.abs(offsetMin);
    const offH = String(Math.floor(absMin / 60)).padStart(2, '0');
    const offM = String(absMin % 60).padStart(2, '0');
    const iso = `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}:${String(parts.second).padStart(2, '0')}${sign}${offH}:${offM}`;
    return {
      iso,
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second,
      offsetMinutes: offsetMin,
      timezone,
    };
  }
}
