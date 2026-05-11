import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { RunnerHookBusService } from '../../hookbus/services/hookbus.service';
import {
  TouchpointConfigSchema,
  type DataTouchpoint,
  type LoadedTouchpoint,
  type TouchpointConfig,
  type TouchpointHandler,
} from '../types/data-touchpoint.types';
import { ScheduleSchema, type Schedule } from './touchpoint-schedule';

/**
 * @title 触点胶水代码加载器与运行时沙箱
 * @description 加载 touchpoint.config.json + 动态 import 胶水代码 default export, 包装受限 callHook (运行时按 config.allowedHooks 白名单拦截), 返回带超时的执行器。
 * @keywords-cn 触点加载, 沙箱, 受限callHook, 白名单, 动态import
 * @keywords-en touchpoint-loader, sandbox, restricted-callhook, allowlist, dynamic-import
 */

/**
 * 沙箱拒绝异常
 * @keyword-en touchpoint-hook-denied
 */
export class TouchpointHookDeniedError extends Error {
  constructor(
    public readonly hookName: string,
    public readonly allowedHooks: string[],
  ) {
    super(
      `hook denied by sandbox: "${hookName}" (allowed: [${allowedHooks.join(', ')}])`,
    );
    this.name = 'TouchpointHookDeniedError';
  }
}

/**
 * 受限 callHook 工厂: 只放行 allowedHooks 列出的 hook 名 (saas.* / runner.* 一视同仁)
 *  - saas.* 由 hookBus.emit 内部按前缀自动路由跨进程到 SaaS, 沙箱不感知
 *  - 多 handler 返回数组, 单 handler 返回首个 data
 *  - 任一 result 是 error 即抛错, 由触点 trigger.service 兜底捕获并回写 status=broken
 *  - context.source='system' (非 LLM 链路, ability 检查可放宽)
 * @keyword-en create-sandboxed-callhook
 */
function createSandboxedCallHook(
  hookBus: RunnerHookBusService,
  config: TouchpointConfig,
  touchpoint: DataTouchpoint,
): (name: string, payload: unknown) => Promise<unknown> {
  return async (hookName, payload) => {
    if (!config.allowedHooks.includes(hookName)) {
      throw new TouchpointHookDeniedError(hookName, config.allowedHooks);
    }
    const results = await hookBus.emit({
      name: hookName,
      payload,
      context: {
        source: 'system',
        principalType: 'system',
        extras: { touchpointId: touchpoint._id },
      },
    });
    if (!results || results.length === 0) {
      return null;
    }
    const errors = results.filter((r) => r.status === 'error');
    if (errors.length > 0) {
      throw new Error(errors[0].error ?? 'sandbox-hook-failed');
    }
    return results.length === 1 ? results[0].data : results.map((r) => r.data);
  };
}

/**
 * 加载触点的 config + 胶水代码; 返回一个带白名单沙箱 + 超时的可执行函数
 * @keyword-en load-touchpoint
 */
export async function loadTouchpoint(
  touchpoint: DataTouchpoint,
  hookBus: RunnerHookBusService,
): Promise<LoadedTouchpoint> {
  // 路径: filePath / configPath 当前阶段当作相对 process.cwd() 解析 (Phase 1.4 solution 物理结构落地后会切换为 solution 根)
  const cwd = process.cwd();
  const configAbs = resolve(cwd, touchpoint.configPath);
  const fileAbs = resolve(cwd, touchpoint.filePath);

  const configRaw = await readFile(configAbs, 'utf-8');
  const config = TouchpointConfigSchema.parse(JSON.parse(configRaw));

  const sandboxedCallHook = createSandboxedCallHook(hookBus, config, touchpoint);

  // 动态 import: 转 file:// URL, 兼容 Windows 路径
  // 加 ?t=<ts> query 强制每次冷加载, 避免 Node 模块缓存导致触点更新无感
  // tsconfig module=CommonJS 下 TS 会把 import() 编译为 require(), 用 Function 包装绕过编译
  const url = pathToFileURL(fileAbs).href + `?t=${touchpoint.updatedAt}`;
  const dynamicImport = new Function(
    'specifier',
    'return import(specifier)',
  ) as (s: string) => Promise<{
    default?: TouchpointHandler;
    handler?: TouchpointHandler;
    highFrequency?: boolean;
    schedule?: unknown;
  }>;
  const mod = await dynamicImport(url);
  const handler = mod.default ?? mod.handler;
  if (typeof handler !== 'function') {
    throw new Error(
      `touchpoint ${touchpoint._id} (${touchpoint.filePath}) has no default export function`,
    );
  }

  const highFrequency = mod.highFrequency === true;
  let schedule: Schedule | undefined;
  if (mod.schedule !== undefined && mod.schedule !== null) {
    const parsed = ScheduleSchema.safeParse(mod.schedule);
    if (!parsed.success) {
      throw new Error(
        `touchpoint ${touchpoint._id} (${touchpoint.filePath}) invalid schedule export: ${parsed.error.message}`,
      );
    }
    schedule = parsed.data;
  }

  const run = async (input: {
    payload: unknown;
    sourceName?: string;
    prevState: unknown;
  }): Promise<unknown> => {
    const ctx = {
      payload: input.payload,
      sourceName: input.sourceName,
      prevState: input.prevState,
      callHook: sandboxedCallHook,
      log: (msg: string, attrs?: Record<string, unknown>) => {
        // eslint-disable-next-line no-console
        console.log(`[touchpoint:${touchpoint.name}]`, msg, attrs ?? '');
      },
      touchpoint,
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`touchpoint timeout after ${config.timeout}ms`)),
        config.timeout,
      );
    });
    try {
      const result = await Promise.race([
        Promise.resolve(handler(ctx)),
        timeoutPromise,
      ]);
      return result;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  return { run, highFrequency, schedule };
}
