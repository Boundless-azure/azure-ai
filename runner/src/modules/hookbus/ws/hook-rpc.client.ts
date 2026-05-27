import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { Socket } from 'socket.io-client';
import { RunnerHookBusService } from '../services/hookbus.service';
import type { HookInvocationContext } from '../types/hook.types';
import type { UnitCoreService } from '../../../unit-core/services/unit-core.service';

/**
 * @title Runner Hook RPC 客户端
 * @description 接收 SaaS 通过 /runner/ws 下发的 hook:call, 维护 in-flight 队列, 分别推送
 *              ack / 3s 周期 progress / 终态 result。统一外形 { errorMsg, result, debugLog }。
 *              同时注册 3 个基础元 hook: runner.system.hookbus.search / .getTag / .getInfo。
 *              envelope.context 透传给 hookBus.emit, 让 handler 可读 token / principalId / traceId 等。
 * @keywords-cn HookRPC客户端, 远程调用, 在途队列, 进度心跳, 元Hook, 调用上下文
 * @keywords-en hook-rpc-client, remote-call, inflight-queue, progress-heartbeat, meta-hook, invocation-context
 */

/** ack 软超时 :: 与 SaaS 端协议常量保持一致 */
const HOOK_CALL_ACK_TIMEOUT_MS = 3000;
/** progress 推送周期 :: 与 SaaS 端 stale 超时配合 (3s push, 5s 才判超时) */
const HOOK_CALL_PROGRESS_INTERVAL_MS = 3000;
/** 单次默认翻页大小 (runner.system.hookbus.search / runner.system.hookbus.getInfo) */
const DEFAULT_PAGE_SIZE = 100;
/** runner.system.hookbus.getTag 单次上限: tag 是发现链路起点, 一次拿全景, 硬上限 400 */
const TAG_PAGE_LIMIT = 400;

interface CallEnvelope {
  callId: string;
  hookName: string;
  payload?: unknown;
  context?: HookInvocationContext;
  debug?: boolean;
  debugDb?: boolean;
}

interface CallReply {
  errorMsg: string[];
  result: unknown;
  debugLog: unknown[];
}

/**
 * 把 RunnerHookBusService 的 HookResult[] 适配成 CallReply 外形
 * - debugLog 来自每个 result.debugLog (debug=true 时由 hookbus.service drain 出来), 拍平合并
 * @keyword-en adapt-bus-result
 */
function adaptResults(
  results: Array<{
    status: string;
    data?: unknown;
    error?: string;
    debugLog?: unknown[];
  }>,
): CallReply {
  const errorMsg: string[] = [];
  const data: unknown[] = [];
  const debugLog: unknown[] = [];
  for (const r of results) {
    if (r.status === 'error' || r.error) {
      errorMsg.push(r.error ?? 'hook-error');
    } else {
      data.push(r.data);
    }
    if (r.debugLog && r.debugLog.length > 0) {
      debugLog.push(...r.debugLog);
    }
  }
  return { errorMsg, result: data, debugLog };
}

/**
 * 把已注册的 hook 列表按 (name, tags, description, pluginName, isComponent) 投影出来
 * @keyword-en project-registrations
 */
function projectRegistrations(
  hookBus: RunnerHookBusService,
): Array<{ name: string; tags: string[]; description: string | null; pluginName: string | null; isComponent: boolean }> {
  const seen = new Set<string>();
  const list: Array<{ name: string; tags: string[]; description: string | null; pluginName: string | null; isComponent: boolean }> = [];
  for (const item of hookBus.listRegistrations()) {
    const key = `${item.name}::${item.metadata?.pluginName ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({
      name: item.name,
      tags: item.metadata?.tags ?? [],
      description: item.metadata?.description ?? null,
      pluginName: item.metadata?.pluginName ?? null,
      isComponent: item.metadata?.isComponent === true,
    });
  }
  return list;
}

/**
 * 注册 3 个元 hook (runner.system.hookbus.search / .getTag / .getInfo)。
 * 仅注册一次, 重复挂载安全 (基于 registration name 去重)。
 * @keyword-en register-meta-hooks
 */
export function registerMetaHooks(hookBus: RunnerHookBusService): void {
  const existing = new Set(hookBus.listRegistrations().map((i) => i.name));

  // 注: payload 入参约定跟 SaaS 端 HookLifecycle args 一致 —— **始终是 array, 真实参数在 args[0]**。
  // dispatchOne / buildSearchHookTool 等调用方都包成 [{ ... }] 形态; schema 用 z.tuple 校验数组首元素结构。
  // 取参数时统一用 readArg(event.payload) 提取 args[0], 兼容旧/新调用方。

  const searchInputSchema = z
    .object({
      tags: z.array(z.string()).optional(),
      pluginName: z.string().optional(),
      cursor: z.number().int().nonnegative().optional(),
      limit: z.number().int().positive().max(DEFAULT_PAGE_SIZE).optional(),
      isWeb: z.boolean().optional(),
    })
    .optional();
  const getTagInputSchema = z
    .object({
      pluginName: z.string().optional(),
      cursor: z.number().int().nonnegative().optional(),
      limit: z.number().int().positive().max(TAG_PAGE_LIMIT).optional(),
      isWeb: z.boolean().optional(),
    })
    .optional();
  const getInfoInputSchema = z
    .object({
      hookNames: z.array(z.string()).optional(),
    })
    .optional();

  if (!existing.has('runner.system.hookbus.search')) {
    hookBus.register(
      'runner.system.hookbus.search',
      (event) => {
        const payload = readArg<{
          tags?: string[];
          pluginName?: string;
          cursor?: number;
          limit?: number;
          isWeb?: boolean;
        }>(event.payload);
        const wantWeb = payload.isWeb === true;
        const wantTags = (payload.tags ?? []).filter(Boolean);
        const all = projectRegistrations(hookBus).filter((item) => {
          if (item.isComponent !== wantWeb) return false;
          if (wantTags.length > 0 && !wantTags.some((t) => item.tags.includes(t))) {
            return false;
          }
          if (payload.pluginName && item.pluginName !== payload.pluginName) return false;
          return true;
        });
        const limit = Math.max(1, Math.min(payload.limit ?? DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE));
        const cursor = Math.max(0, payload.cursor ?? 0);
        const slice = all.slice(cursor, cursor + limit);
        const nextCursor = cursor + slice.length < all.length ? cursor + slice.length : null;
        return {
          status: 'success',
          data: { items: slice, total: all.length, cursor, nextCursor },
        };
      },
      {
        description:
          '搜索已注册 hook, 支持 tags 任一命中 / pluginName 过滤, 默认每页 100 条, 通过 cursor 翻页. ' +
          'isWeb=false (默认) 只返回普通 hook; isWeb=true 只返回 Web Component Hook。两类严格分离，不传 isWeb 不会返回组件。',
        tags: ['meta'],
        // args 形参: 跟 SaaS HookLifecycle 一致, payload[0] 是参数对象
        payloadSchema: z.tuple([searchInputSchema]),
      },
    );
  }

  if (!existing.has('runner.system.hookbus.getTag')) {
    hookBus.register(
      'runner.system.hookbus.getTag',
      (event) => {
        const payload = readArg<{
          pluginName?: string;
          cursor?: number;
          limit?: number;
          isWeb?: boolean;
        }>(event.payload);
        const wantWeb = payload.isWeb === true;
        const tagCount = new Map<string, number>();
        for (const item of projectRegistrations(hookBus)) {
          if (item.isComponent !== wantWeb) continue;
          if (payload.pluginName && item.pluginName !== payload.pluginName) continue;
          for (const t of item.tags) {
            tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
          }
        }
        const sorted = Array.from(tagCount.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count }));
        const limit = Math.max(1, Math.min(payload.limit ?? TAG_PAGE_LIMIT, TAG_PAGE_LIMIT));
        const cursor = Math.max(0, payload.cursor ?? 0);
        const slice = sorted.slice(cursor, cursor + limit);
        const nextCursor = cursor + slice.length < sorted.length ? cursor + slice.length : null;
        return {
          status: 'success',
          data: { items: slice, total: sorted.length, cursor, nextCursor },
        };
      },
      {
        description:
          `获取已注册 hook 的 tag 频次榜, 支持 pluginName 过滤, 默认/上限 ${TAG_PAGE_LIMIT} 条, 超过用 cursor 翻页. ` +
          'isWeb=false (默认) 只统计普通 hook 的 tag; isWeb=true 只统计 Web Component Hook 的 tag。',
        tags: ['meta'],
        payloadSchema: z.tuple([getTagInputSchema]),
      },
    );
  }

  if (!existing.has('runner.system.hookbus.getInfo')) {
    hookBus.register(
      'runner.system.hookbus.getInfo',
      (event) => {
        const payload = readArg<{ hookNames?: string[] }>(event.payload);
        const want = new Set(payload.hookNames ?? []);
        const items: Array<{
          name: string;
          description: string | null;
          tags: string[];
          pluginName: string | null;
          payloadSchema: unknown | null;
          requiredAbility:
            | { action: string; subject: string }
            | Array<{ action: string; subject: string }>
            | null;
        }> = [];
        const all = hookBus.listRegistrations();
        for (const item of all) {
          if (want.size > 0 && !want.has(item.name)) continue;
          let schema: unknown = null;
          const zod = item.metadata?.payloadSchema;
          if (zod) {
            try {
              schema = z.toJSONSchema(zod);
            } catch {
              schema = null;
            }
          }
          items.push({
            name: item.name,
            description: item.metadata?.description ?? null,
            tags: item.metadata?.tags ?? [],
            pluginName: item.metadata?.pluginName ?? null,
            payloadSchema: schema,
            requiredAbility: item.metadata?.requiredAbility ?? null,
          });
        }
        return { status: 'success', data: { items } };
      },
      {
        description:
          '批量获取 hook 的描述/tags/payload JSON Schema (Zod 派生)/requiredAbility (CASL action+subject), 不传 hookNames 则返回全部',
        tags: ['meta'],
        payloadSchema: z.tuple([getInfoInputSchema]),
      },
    );
  }
}

/**
 * 统一参数读取: meta hook 调用方约定 payload=[{...}] 数组, 但允许兼容旧调用 payload={...} object;
 * 返回 args[0] 或 {} (零参数也合法).
 * @keyword-en read-meta-hook-arg
 */
function readArg<T extends object>(payload: unknown): T {
  if (Array.isArray(payload)) {
    const head = payload[0];
    if (head && typeof head === 'object') return head as T;
    return {} as T;
  }
  if (payload && typeof payload === 'object') return payload as T;
  return {} as T;
}

/**
 * Runner→SaaS hook 调用: 通过 Socket 连接向 SaaS 发 hook:call, 等待 hook:result 返回。
 * @description 复用双向 RPC 协议, context 携带用户 token 实现鉴权。
 * @keyword-en call-saas-hook
 */
function createCallSaaSHook(socket: Socket) {
  return async (
    hookName: string,
    payload: unknown,
    context?: HookInvocationContext,
  ): Promise<{ errorMsg?: string[]; result: unknown }> => {
    const callId = `runner-saas.${randomUUID().slice(0, 12)}`;
    return new Promise((resolve) => {
      const handler = (data: { callId: string; reply: CallReply }) => {
        if (data.callId === callId) {
          socket.off('hook:result', handler);
          resolve(data.reply);
        }
      };
      socket.on('hook:result', handler);
      socket.emit('hook:call', { callId, hookName, payload, context });
      setTimeout(() => {
        socket.off('hook:result', handler);
        resolve({ errorMsg: ['saas-rpc-timeout'], result: null });
      }, 10000);
    });
  };
}

/**
 * 把 hook-rpc 协议挂到一个已建立的 socket-client 上。
 * @description 监听 hook:call, 维护 in-flight Map, 推 ack 后启 3s tick 推 progress, 结果用 hook:result 回包。
 *              重复挂载安全: 通过 socket 已绑定标记避免双注册。
 *              envelope.context 透传给 hookBus.emit, 让 handler 通过 event.context 读 token 等环境信息。
 *              同时把 callSaaSHook 注入: ① unitCore (legacy, unit handler 直接反向调) ② hookBus.setForwardToSaaS (统一保底, hookBus.emit 见 saas.* 前缀自动转发)。
 * @keyword-en attach-hook-rpc
 */
export function attachHookRpc(
  socket: Socket,
  hookBus: RunnerHookBusService,
  unitCore?: UnitCoreService,
): void {
  type AnnotatedSocket = Socket & { __hookRpcAttached?: boolean };
  const s = socket as AnnotatedSocket;
  if (s.__hookRpcAttached) return;
  s.__hookRpcAttached = true;

  // 注入 Runner→SaaS hook 调用能力
  const callSaaSHook = createCallSaaSHook(socket);
  unitCore?.setCallSaaSHook(callSaaSHook);
  hookBus.setForwardToSaaS(callSaaSHook);

  registerMetaHooks(hookBus);

  const inflight = new Set<string>();
  let tick: NodeJS.Timeout | null = null;

  const ensureTick = () => {
    if (tick !== null) return;
    tick = setInterval(() => {
      if (inflight.size === 0) {
        if (tick) {
          clearInterval(tick);
          tick = null;
        }
        return;
      }
      socket.emit('hook:progress', {
        callIds: Array.from(inflight),
        ts: Date.now(),
      });
    }, HOOK_CALL_PROGRESS_INTERVAL_MS).unref?.() ?? tick;
  };

  socket.on('disconnect', () => {
    if (tick) {
      clearInterval(tick);
      tick = null;
    }
    inflight.clear();
  });

  socket.on('hook:call', async (envelope: CallEnvelope) => {
    if (!envelope?.callId || !envelope?.hookName) {
      return;
    }
    inflight.add(envelope.callId);
    socket.emit('hook:ack', { callId: envelope.callId });
    ensureTick();
    let reply: CallReply;
    try {
      // envelope.debug 透过 context.extras.debug 透传给 hookBus, 由 hookbus.service 创建 OTel session
      // 注入 event.log; handler 写的日志在 result.debugLog 里出来, adaptResults 拍平合并到 reply.debugLog
      const enrichedContext: HookInvocationContext | undefined = envelope.debug
        ? {
            ...(envelope.context ?? {}),
            extras: { ...(envelope.context?.extras ?? {}), debug: true },
          }
        : envelope.context;
      const results = await hookBus.emit({
        name: envelope.hookName,
        payload: envelope.payload,
        context: enrichedContext,
      });
      reply = adaptResults(
        results as unknown as Array<{
          status: string;
          data?: unknown;
          error?: string;
          debugLog?: unknown[];
        }>,
      );
      // debugDb :: 占位, 后续接入 Mongo shadow (Phase 2)
      if (envelope.debugDb) {
        reply.debugLog.push({ level: 'info', msg: 'debug-db placeholder, mongo shadow pending' });
      }
    } catch (e) {
      reply = {
        errorMsg: [e instanceof Error ? e.message : String(e)],
        result: null,
        debugLog: [],
      };
    } finally {
      inflight.delete(envelope.callId);
    }
    socket.emit('hook:result', { callId: envelope.callId, reply });
  });

  // 占位: ack 超时常量已通过 socket emit 协议体现, 此处导出以备调试
  void HOOK_CALL_ACK_TIMEOUT_MS;
}
