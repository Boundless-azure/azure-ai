/**
 * @title Hook Component Ctx
 * @description Web Component Hook 组件的能力注入对象。组件 render(container, payload, ctx) 通过 ctx
 *              统一访问数据,不再自己拼 API URL、读 localStorage token、派发全局事件。
 *              callHook 经 POST /hook-invoke 由 SaaS 按 4 段 hook 名自动路由(SaaS/Runner)并注入鉴权;
 *              token 由共享 http 拦截器统一附加,组件不可见。
 *              本对象全异步 + 可序列化,作为未来 iframe 沙箱(ctx 改 postMessage 转发)的前置接缝。
 *              Phase 1 提供 callHook(单条/批量)/navigate/refresh;cachedFetch/report(http 通道)后续阶段补。
 * @keywords-cn hook组件上下文, 能力注入, 统一请求器, hook调用, token收口
 * @keywords-en hook-component-ctx, capability-injection, unified-requester, call-hook, token-funneling
 */
import { http } from '../../../../utils/http';

/** 单条 hook 调用入参 @keyword-en hook-call-input */
export interface HookCall {
  hookName: string;
  payload?: unknown;
}

/** 单条 hook 调用结果(批量时按 hookName 对齐回带) @keyword-en hook-call-result */
export interface HookCallResult {
  hookName: string;
  ok: boolean;
  data?: unknown;
  errorMsg?: string;
}

/** /hook-snapshot 端点的响应体(非 wrapped 格式,经 http 客户端落在 BaseResponse.data 上) */
interface HookInvokeReply {
  ok: boolean;
  data?: unknown;
  errorMsg?: string;
  /** true=返回的是冻结快照;false=本次实时拉取 */
  cached?: boolean;
}

/**
 * 组件能力注入对象。
 * @keyword-en hook-component-ctx-interface
 */
export interface HookComponentCtx {
  /**
   * 按 hook 全名调用,SaaS 自动路由 + 注入鉴权。
   * 单条:返回 hook 结果数据(失败抛错);批量:传 calls 数组,返回按 hookName 对齐的结果数组(软错误不抛)。
   * @keyword-en call-hook
   */
  callHook: {
    (hookName: string, payload?: unknown, opts?: { live?: boolean }): Promise<unknown>;
    (calls: HookCall[], opts?: { live?: boolean }): Promise<HookCallResult[]>;
  };
  /**
   * 打开/切换右侧面板 Tab,取代组件直接 window.dispatchEvent('hookComponent:navigate')。
   * @keyword-en ctx-navigate
   */
  navigate(tab: string, label?: string, props?: Record<string, unknown>): void;
  /**
   * 显式重拉并重新挂载当前组件视图。
   * @keyword-en ctx-refresh
   */
  refresh(): Promise<void>;
  /** 组件所属消息 id(快照锚定用) @keyword-en ctx-message-id */
  readonly messageId: string;
  /** 组件所属会话 id @keyword-en ctx-session-id */
  readonly sessionId: string;
}

/** 调用选项:messageId 锚定快照,live 跳过缓存实时拉 @keyword-en invoke-opts */
interface InvokeOpts {
  messageId?: string;
  live?: boolean;
}

/**
 * 调用单个 hook,经 POST /hook-snapshot 由 SaaS 路由 + 写一次快照缓存。
 * 携带 messageId(快照锚定)与 live(跳过缓存);token 由 http 拦截器统一附加。
 * @keyword-en invoke-hook
 */
async function invokeHook(
  hookName: string,
  payload?: unknown,
  opts?: InvokeOpts,
): Promise<HookInvokeReply> {
  try {
    const res = await http.post<HookInvokeReply>('/hook-snapshot', {
      hookName,
      payload,
      messageId: opts?.messageId,
      live: opts?.live,
    });
    return res.data;
  } catch (e) {
    return { ok: false, errorMsg: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 前端模块级快照缓存:键 `${messageId}::${hookName}#${hash}`,值为请求 Promise。
 * 消息列表重渲染会重建 hook slot、丢 data-mounted 并重新挂载组件 → 若无此缓存就会对同一
 * (消息, hook, payload) 重复发请求。缓存 Promise 同时去重「进行中」与「已完成」,命中则不发 HTTP;
 * 请求失败则删除以允许重试。与服务端 message.metadata.hookSnapshots 同语义,key 算法逐字一致。
 * @keyword-en client-snapshot-cache, dedupe-requests
 */
const clientSnapshotCache = new Map<string, Promise<unknown>>();

/** 快照 key = `${hookName}#${fnv1a(canonical(payload))}`,与服务端 HookSnapshotService 逐字一致 @keyword-en snapshot-key */
function snapshotKey(hookName: string, payload: unknown): string {
  const keyPayload = payload == null ? {} : payload;
  return `${hookName}#${fnv1a(stableStringify(keyPayload))}`;
}

/** 客户端缓存键 = `${messageId}::${snapshotKey}` @keyword-en client-cache-key */
function clientCacheKey(messageId: string, hookName: string, payload: unknown): string {
  return `${messageId}::${snapshotKey(hookName, payload)}`;
}

/**
 * 用消息历史带下来的 hookSnapshots 预热客户端缓存,使回看时连首个请求都省掉。
 * @keyword-en seed-client-snapshots
 */
export function seedClientSnapshots(
  messageId: string,
  snaps: Record<string, { data: unknown }> | undefined | null,
): void {
  if (!messageId || !snaps) return;
  for (const key of Object.keys(snaps)) {
    const ck = `${messageId}::${key}`;
    if (!clientSnapshotCache.has(ck)) {
      clientSnapshotCache.set(ck, Promise.resolve(snaps[key].data));
    }
  }
}

/** 清除某消息的全部客户端快照(供 refresh 强制重拉) @keyword-en clear-client-snapshots */
function clearClientSnapshots(messageId: string): void {
  if (!messageId) return;
  const prefix = `${messageId}::`;
  for (const k of clientSnapshotCache.keys()) {
    if (k.startsWith(prefix)) clientSnapshotCache.delete(k);
  }
}

/** 稳定序列化(键排序),与服务端 HookSnapshotService.stableStringify 逐字一致 @keyword-en stable-stringify */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** FNV-1a 32 位哈希 base36,与服务端 HookSnapshotService.fnv1a 逐字一致 @keyword-en fnv1a-hash */
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * 构造组件能力注入对象。navigate / refresh 由调用方(渲染器)以闭包传入,callHook 走统一 http 请求器 +
 * 客户端快照缓存(命中不发请求)。
 * @keyword-en create-hook-component-ctx
 */
export function createHookComponentCtx(opts: {
  messageId: string;
  sessionId: string;
  openTab: (tab: string, label: string, props?: Record<string, unknown>) => void;
  refresh: () => Promise<void>;
}): HookComponentCtx {
  const mid = opts.messageId;

  // 单条调用:非 live 且有 messageId 时走客户端 Promise 缓存(去重进行中+已完成,失败删除允许重试)
  const callOne = (hookName: string, payload: unknown, live?: boolean): Promise<unknown> => {
    const ck = !live && mid ? clientCacheKey(mid, hookName, payload) : null;
    if (ck) {
      const cached = clientSnapshotCache.get(ck);
      if (cached) return cached;
    }
    const p = invokeHook(hookName, payload, { messageId: mid, live }).then((r) => {
      if (!r.ok) throw new Error(r.errorMsg ?? `hook error: ${hookName}`);
      return r.data;
    });
    if (ck) {
      clientSnapshotCache.set(ck, p);
      p.catch(() => clientSnapshotCache.delete(ck)); // 失败不留缓存
    }
    return p;
  };

  // 批量:复用 callOne 的缓存/去重,结果按 hookName 对齐回带(软错误不抛)
  const callBatch = (calls: HookCall[], live?: boolean): Promise<HookCallResult[]> =>
    Promise.all(
      calls.map((c) =>
        callOne(c.hookName, c.payload, live).then(
          (data): HookCallResult => ({ hookName: c.hookName, ok: true, data }),
          (e): HookCallResult => ({
            hookName: c.hookName,
            ok: false,
            errorMsg: e instanceof Error ? e.message : String(e),
          }),
        ),
      ),
    );

  const callHook = (
    arg: string | HookCall[],
    payloadOrOpts?: unknown,
    maybeOpts?: { live?: boolean },
  ): Promise<unknown> => {
    if (Array.isArray(arg)) {
      const batchOpts = payloadOrOpts as { live?: boolean } | undefined;
      return callBatch(arg, batchOpts?.live);
    }
    return callOne(arg, payloadOrOpts, maybeOpts?.live);
  };

  return {
    callHook: callHook as HookComponentCtx['callHook'],
    navigate: (tab, label, props) => opts.openTab(tab, label ?? tab, props ?? {}),
    // refresh 先清本消息客户端快照,再重挂载 → 触发重新请求(服务端写一次语义下仍返冻结值,
    // 真正改写需服务端 forceRefresh,属后续项)
    refresh: async () => {
      clearClientSnapshots(mid);
      await opts.refresh();
    },
    messageId: opts.messageId,
    sessionId: opts.sessionId,
  };
}
