import { z } from 'zod';

/**
 * @title 时区处理 hook payload schemas (SSOT)
 * @description 单一来源, schema 给 LLM JSONSchema 派生 + 运行时校验, type 由 z.infer 派生供 handler 签名复用。
 *              所有时间字段使用 ISO 8601 字符串 (含时区偏移或 UTC `Z` 后缀); timezone 字段使用 IANA 名 (如 `Asia/Shanghai`)。
 * @keywords-cn 时区, UTC, IANA, schema, IP定位
 * @keywords-en time-zone, utc, iana, schema, ip-locate
 */

/**
 * IANA 时区名校验 - 借 Intl.DateTimeFormat 内置校验 (无依赖)
 * @keyword-en iana-timezone-string
 */
const ianaTimezone = z
  .string()
  .min(1)
  .refine(
    (tz) => {
      try {
        // 不合法 timezone 会抛 RangeError
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: 'invalid IANA timezone name (e.g. Asia/Shanghai, UTC)' },
  );

/**
 * 本地时间字符串 → UTC ISO
 * @keyword-en to-utc-schema
 */
export const ToUtcSchema = z.object({
  localTime: z
    .string()
    .min(1)
    .describe(
      'ISO 8601 本地时间字符串 (不带时区, 或带时区视为已知; e.g. "2026-05-16 09:00:00" / "2026-05-16T09:00:00")',
    ),
  fromTimezone: ianaTimezone.describe(
    '该 localTime 所在的 IANA 时区名 (e.g. Asia/Shanghai, America/New_York)',
  ),
});
export type ToUtcInput = z.infer<typeof ToUtcSchema>;

/**
 * UTC ISO → 指定时区的本地表示
 * @keyword-en from-utc-schema
 */
export const FromUtcSchema = z.object({
  utcTime: z
    .string()
    .min(1)
    .describe('UTC ISO 8601 字符串 (e.g. "2026-05-16T01:00:00Z")'),
  toTimezone: ianaTimezone.describe('目标 IANA 时区名'),
});
export type FromUtcInput = z.infer<typeof FromUtcSchema>;

/**
 * 当前时间在指定时区下的表示 (timezone 不传则只回 UTC)
 * @keyword-en now-schema
 */
export const NowSchema = z.object({
  timezone: ianaTimezone
    .optional()
    .describe('目标 IANA 时区名; 不传只返回 UTC 当前时间'),
});
export type NowInput = z.infer<typeof NowSchema>;

/**
 * IP → 时区查询
 * @keyword-en lookup-by-ip-schema
 */
export const LookupByIpSchema = z.object({
  ip: z
    .string()
    .min(1)
    .describe('IPv4 / IPv6 地址 (e.g. "1.2.3.4" / "2001:db8::1")'),
});
export type LookupByIpInput = z.infer<typeof LookupByIpSchema>;

/**
 * fromUtc / now 的本地时间分量 (方便调用方直接拿 年/月/日 不用再 parse 字符串)
 * @keyword-en local-time-parts
 */
export interface LocalTimeParts {
  /** 本地时间 ISO 字符串, 含时区偏移 (e.g. "2026-05-16T09:00:00+08:00") */
  iso: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 当前时区相对 UTC 的偏移分钟数, 东半球为正 (e.g. Asia/Shanghai → +480) */
  offsetMinutes: number;
  /** IANA 时区名 (回声调用方传入的, 方便链式) */
  timezone: string;
}

/**
 * IP 查询结果
 * @keyword-en lookup-by-ip-result
 */
export interface LookupByIpResult {
  /** IANA 时区名; 查不到时兜底 'UTC' */
  timezone: string;
  /** ISO 3166-1 alpha-2 国家码 (可选; 查不到为 null) */
  country: string | null;
  /** 行政区/城市 (可选, 当前 stub 实现不返回, 留接口待 GeoIP 接入) */
  region: string | null;
  /** 数据源标识 (debug 用; 当前 stub 实现固定 'stub-utc-fallback') */
  source: string;
}
