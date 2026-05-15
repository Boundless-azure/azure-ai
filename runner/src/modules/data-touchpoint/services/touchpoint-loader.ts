import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import type { RunnerHookBusService } from '../../hookbus/services/hookbus.service';
import {
  TouchpointConfigSchema,
  type DataTouchpoint,
  type TouchpointConfig,
} from '../types/data-touchpoint.types';
import { resolveTouchpointFile } from './touchpoint-paths';
import { ScheduleSchema, type Schedule } from './touchpoint-schedule';

/**
 * @title 触点元数据加载器 + 受限 callHook 工厂
 * @description 解析 + 校验路径 (touchpoint-paths) → 读 config → 主线程 dynamic import 一次取胶水元数据 (highFrequency / schedule)
 *              → 返回 fileUrl + sandboxedCallHook 给 executor 在 worker_thread 里跑真正的 handler。
 *              主线程不直接执行 handler, 超时与 kill 由 executor (touchpoint-executor.ts) 接管。
 *              沙箱 callHook 走 bindAgentId 当 principal, 让 saas.* 跨进程鉴权按 agent 自身能力。
 * @keywords-cn 触点加载, 路径校验, 受限callHook, 白名单, 元数据预读, bindAgentId主体
 * @keywords-en touchpoint-loader, path-guard, restricted-callhook, allowlist, metadata-preread, bindagentid-principal
 */

/**
 * 沙箱拒绝异常 (hook 名不在 allowedHooks 内). executor 主线程捕获后转译为 outcome='denied'.
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
 * 加载后的触点 bundle: 主线程跑 schedule/state 决策 + 把 fileUrl 交给 executor 在 worker 里跑
 * @keyword-en loaded-touchpoint
 */
export interface LoadedTouchpoint {
  config: TouchpointConfig;
  /** file:// URL with ?t=<updatedAt> 缓存破坏 query; 直接传给 worker 动态 import */
  fileUrl: string;
  /** 主线程侧受限 callHook; executor 收到 worker 的 RPC 后调用此函数 */
  sandboxedCallHook: (name: string, payload: unknown) => Promise<unknown>;
  /** 胶水 export const highFrequency = true → state 走 redis */
  highFrequency: boolean;
  /** 胶水 export const schedule = ... → 注册 BullMQ Repeatable */
  schedule?: Schedule;
}

/**
 * 受限 callHook 工厂: 只放行 allowedHooks 列出的 hook 名 (saas.* / runner.* 一视同仁)
 *  - 主体身份取 touchpoint.bindAgentId (principalType='agent'), 让 saas 端 ability 中间件按 agent 鉴权
 *  - 多 handler 返回数组, 单 handler 返回首个 data
 *  - 任一 result.error 直接抛错, 由 executor 翻译成 outcome
 *  - hook 名不在白名单 → TouchpointHookDeniedError, executor 翻译成 outcome='denied'
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
        principalId: touchpoint.bindAgentId,
        principalType: 'agent',
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
 * 加载触点 config + 预读胶水元数据 (highFrequency / schedule); 真 handler 由 executor 在 worker 里 import 跑。
 *  - rootDir 缺省 process.cwd(), 等 Phase 1.4 切到 solution 根
 *  - 路径防护: 绝对路径 / `..` 逃逸 / symlink 逃逸都抛 TouchpointPathDeniedError
 *  - 主线程 import 仅为读元数据; 胶水代码 top-level 应只有 export, 不允许有副作用 (约定, 不强校验)
 *  - 用 ?t=<updatedAt> 强制 cache miss; 触点 update 后下次加载会取新版
 * @keyword-en load-touchpoint
 */
export async function loadTouchpoint(
  touchpoint: DataTouchpoint,
  hookBus: RunnerHookBusService,
  rootDir: string = process.cwd(),
): Promise<LoadedTouchpoint> {
  const fileAbs = resolveTouchpointFile(rootDir, touchpoint.filePath);
  const configAbs = resolveTouchpointFile(rootDir, touchpoint.configPath);

  const configRaw = await readFile(configAbs, 'utf-8');
  const config = TouchpointConfigSchema.parse(JSON.parse(configRaw));

  const sandboxedCallHook = createSandboxedCallHook(hookBus, config, touchpoint);

  const fileUrl = pathToFileURL(fileAbs).href + `?t=${touchpoint.updatedAt}`;

  // 主线程 import 一次预读元数据 (highFrequency / schedule + 校验 default export 存在)
  // tsconfig module=CommonJS 下 TS 会把 import() 编译为 require(), 用 Function 包装绕过编译
  const dynamicImport = new Function(
    'specifier',
    'return import(specifier)',
  ) as (s: string) => Promise<{
    default?: unknown;
    handler?: unknown;
    highFrequency?: boolean;
    schedule?: unknown;
  }>;
  const mod = await dynamicImport(fileUrl);
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

  return { config, fileUrl, sandboxedCallHook, highFrequency, schedule };
}
