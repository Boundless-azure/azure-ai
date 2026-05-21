# 时区模块

**模块路径**: `src/app/time-zone/`

## 模块功能描述

提供 `saas.app.timeZone.*` 系列工具型 hook, 专门处理 UTC ↔ IANA 时区转换 + IP 定位时区。设计动机:

- **Runner 内部时间统一 UTC** :: runner docker 镜像固定 `TZ=UTC`, 触点胶水代码 / agent 处理时间永远基于 UTC, 避免假设服务器时区
- **业务需要本地时间时显式调** :: 用户视角的"今天早上 9 点" / "下周二"等表达式必须先通过本模块的 hook 转换, 不要假设 Date 构造函数的隐式行为
- **零依赖实现** :: 基于 Node 内置 `Intl.DateTimeFormat`, 不引第三方库 (IP 查询当前是 stub, 接 GeoIP 是后续 TODO)

## 关键词索引

- 时区转换 / UTC ↔ IANA -> services/time-zone.service.ts (TimeZoneService)
- 时区 hook-controller 注册 (saas.app.timeZone.*) -> controllers/time-zone.hook-controller.ts (TimeZoneHookController)
- 时区 schema / zod -> types/time-zone.types.ts (ToUtcSchema / FromUtcSchema / NowSchema / LookupByIpSchema)
- IP → 时区 (stub) -> services/time-zone.service.ts (lookupByIp)

## 模块文件

- `time-zone.module.ts` - NestJS 模块声明; providers 含 service + hook-controller
- `services/time-zone.service.ts` - 业务实现 (Intl-based UTC↔时区转换 + IP stub)
- `controllers/time-zone.hook-controller.ts` - 注册 4 个 hook (`@HookController(pluginName=time-zone, tags=[time-zone,time])` + `@HookRoute` 自动扫描)
- `types/time-zone.types.ts` - zod schema (SSOT) + 返回值 types

## HookBus Hook

| Hook 名 | 描述 | payload | 返回 |
|---------|------|---------|------|
| saas.app.timeZone.toUtc | 本地时间 + IANA 时区 → UTC ISO | [{ localTime, fromTimezone }] | { utc: ISO Z } |
| saas.app.timeZone.fromUtc | UTC → 指定时区本地分量 | [{ utcTime, toTimezone }] | { iso, year, month, day, hour, minute, second, offsetMinutes, timezone } |
| saas.app.timeZone.now | 当前时间 (可选含某时区) | [{ timezone? }] | { utc, local? } |
| saas.app.timeZone.lookupByIp | IP → 时区 (stub UTC fallback) | [{ ip }] | { timezone, country, region, source } |

## 核心函数

### services/time-zone.service.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `toUtc(localTime, fromTimezone)` | 本地 → UTC; 算法 :: 按 UTC 解析得伪 UTC ms → 算 fromTimezone 在该时刻偏移 → 反推真 UTC ms |
| `fromUtc(utcTime, toTimezone)` | UTC → 本地分量; 用 Intl.DateTimeFormat.formatToParts + 反算偏移 |
| `now(timezone?)` | 当前时间; timezone 不传只回 UTC |
| `lookupByIp(ip)` | IP 查时区 (当前 stub, 接 GeoIP 是 TODO) |
| `parseNaiveMs(timeStr)` (private) | 解析"无时区"时间字符串为伪 UTC ms |
| `getOffsetMinutes(utcMs, timezone)` (private) | 拿指定 UTC 时刻在 timezone 下的偏移分钟数 |
| `getDateParts(utcMs, timezone)` (private) | 拿 utcMs 在 timezone 下的年月日时分秒 |
| `composeLocalParts(utcMs, timezone)` (private) | 组装 LocalTimeParts (含带偏移 ISO) |

### controllers/time-zone.hook-controller.ts

| 函数名 | 关键词描述 |
|--------|-----------|
| `handleToUtc / handleFromUtc / handleNow / handleLookupByIp` | 4 个 @HookRoute 方法, payload 数组按形参展开, 调用 service 业务实现, 统一软错返回 |

## 关键约定

- **不挂 @CheckAbility** :: 时区是工具型, 不接业务数据; ability middleware 在 `declaration.requiredAbility` 为空时自动放行
- **零依赖** :: 不引 date-fns / luxon / moment; IP 查询不引 geoip-lite (当前 stub)
- **IANA 时区名** :: 强约束, zod refine 在 schema 层用 `Intl.DateTimeFormat` 校验合法性
- **iso 带偏移格式** :: fromUtc / composeLocalParts 输出的 iso 含 `+08:00` 这种偏移, 不用 `Z`, 方便区分"已在某时区下的本地视图"
- **stub fallback 透明** :: lookupByIp 失败兜底返回 `timezone: 'UTC'`, 调用方应能容忍 UTC fallback 不影响业务流程

## 待补

- [ ] IP → 时区接真实数据源 (geoip-lite / ip2location-lite / 外部 API), 只需改 `TimeZoneService.lookupByIp` 实现, hook 接口不变
- [ ] 增加 `format` hook (UTC + format pattern + timezone → 格式化字符串)
- [ ] 增加 `parse` hook (text + format + timezone → UTC ISO)
- [ ] 单元测试 (跨夏令时 / 跨日界 / 闰秒边界场景)

## 使用示例

### 把"用户说的早上 9 点"转成 UTC 存库

```ts
const result = await callHook('saas.app.timeZone.toUtc', [{
  localTime: '2026-05-16 09:00:00',
  fromTimezone: 'Asia/Shanghai',
}]);
// result.data.utc === '2026-05-16T01:00:00.000Z'
```

### 把数据库里的 UTC 时间展示给用户

```ts
const result = await callHook('saas.app.timeZone.fromUtc', [{
  utcTime: '2026-05-16T01:00:00.000Z',
  toTimezone: 'Asia/Shanghai',
}]);
// result.data.iso === '2026-05-16T09:00:00+08:00'
// result.data.hour === 9
```

### 数据触点胶水代码场景: 获取触发用户的时区

```ts
// 1. 拿触发用户 IP (业务上下文里通常有)
const tzResult = await callHook('saas.app.timeZone.lookupByIp', [{ ip: userIp }]);
const userTz = tzResult.data.timezone;

// 2. 拿 UTC 当前时间并转用户时区显示
const now = await callHook('saas.app.timeZone.now', [{ timezone: userTz }]);
// now.data.local.iso === '2026-05-16T09:30:00+08:00' (如果用户在上海)
```
