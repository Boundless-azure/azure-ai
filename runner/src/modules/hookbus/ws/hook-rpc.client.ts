import { z } from 'zod';
import type { Socket } from 'socket.io-client';
import { RunnerHookBusService } from '../services/hookbus.service';
import type { HookInvocationContext } from '../types/hook.types';

/**
 * @title Runner Hook RPC 客户端
 * @description 接收 SaaS 通过 /runner/ws 下发的 hook:call, 维护 in-flight 队列, 分别推送
 *              ack / 3s 周期 progress / 终态 result。统一外形 { errorMsg, result, debugLog }。
 *              同时注册 3 个基础元 hook: search_hook / get_hook_tag / get_hook_info。
 *              envelope.context 透传给 hookBus.emit, 让 handler 可读 token / principalId / traceId 等。
 * @keywords-cn HookRPC客户端, 远程调用, 在途队列, 进度心跳, 元Hook, 调用上下文
 * @keywords-en hook-rpc-client, remote-call, inflight-queue, progress-heartbeat, meta-hook, invocation-context
 */

/** ack 软超时 :: 与 SaaS 端协议常量保持一致 */
const HOOK_CALL_ACK_TIMEOUT_MS = 3000;
/** progress 推送周期 :: 与 SaaS 端 stale 超时配合 (3s push, 5s 才判超时) */
const HOOK_CALL_PROGRESS_INTERVAL_MS = 3000;
/** 单次默认翻页大小 */
const DEFAULT_PAGE_SIZE = 100;

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
 * @keyword-en adapt-bus-result
 */
function adaptResults(results: Array<{ status: string; data?: unknown; error?: string }>): CallReply {
  const errorMsg: string[] = [];
  const data: unknown[] = [];
  for (const r of results) {
    if (r.status === 'error' || r.error) {
      errorMsg.push(r.error ?? 'hook-error');
    } else {
      data.push(r.data);
    }
  }
  return { errorMsg, result: data, debugLog: [] };
}

/**
 * 把已注册的 hook 列表按 (name, tags, description, pluginName) 投影出来
 * @keyword-en project-registrations
 */
function projectRegistrations(
  hookBus: RunnerHookBusService,
): Array<{ name: string; tags: string[]; description: string | null; pluginName: string | null }> {
  const seen = new Set<string>();
  const list: Array<{ name: string; tags: string[]; description: string | null; pluginName: string | null }> = [];
  for (const item of hookBus.listRegistrations()) {
    const key = `${item.name}::${item.metadata?.pluginName ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({
      name: item.name,
      tags: item.metadata?.tags ?? [],
      description: item.metadata?.description ?? null,
      pluginName: item.metadata?.pluginName ?? null,
    });
  }
  return list;
}

/**
 * 注册 3 个元 hook (search_hook / get_hook_tag / get_hook_info)。
 * 仅注册一次, 重复挂载安全 (基于 registration name 去重)。
 * @keyword-en register-meta-hooks
 */
export function registerMetaHooks(hookBus: RunnerHookBusService): void {
  const existing = new Set(hookBus.listRegistrations().map((i) => i.name));

  if (!existing.has('search_hook')) {
    hookBus.register(
      'search_hook',
      (event) => {
        const payload = (event.payload ?? {}) as {
          tags?: string[];
          pluginName?: string;
          cursor?: number;
          limit?: number;
        };
        const wantTags = (payload.tags ?? []).filter(Boolean);
        const all = projectRegistrations(hookBus).filter((item) => {
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
          '搜索已注册 hook, 支持 tags 任一命中 / pluginName 过滤, 默认每页 100 条, 通过 cursor 翻页',
        tags: ['meta'],
        payloadSchema: z.object({
          tags: z.array(z.string()).optional(),
          pluginName: z.string().optional(),
          cursor: z.number().int().nonnegative().optional(),
          limit: z.number().int().positive().max(DEFAULT_PAGE_SIZE).optional(),
        }),
      },
    );
  }

  if (!existing.has('get_hook_tag')) {
    hookBus.register(
      'get_hook_tag',
      (event) => {
        const payload = (event.payload ?? {}) as {
          pluginName?: string;
          cursor?: number;
          limit?: number;
        };
        const tagCount = new Map<string, number>();
        for (const item of projectRegistrations(hookBus)) {
          if (payload.pluginName && item.pluginName !== payload.pluginName) continue;
          for (const t of item.tags) {
            tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
          }
        }
        const sorted = Array.from(tagCount.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count }));
        const limit = Math.max(1, Math.min(payload.limit ?? DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE));
        const cursor = Math.max(0, payload.cursor ?? 0);
        const slice = sorted.slice(cursor, cursor + limit);
        const nextCursor = cursor + slice.length < sorted.length ? cursor + slice.length : null;
        return {
          status: 'success',
          data: { items: slice, total: sorted.length, cursor, nextCursor },
        };
      },
      {
        description: '获取已注册 hook 的 tag 频次榜, 支持 pluginName 过滤, 默认每页 100 条, 通过 cursor 翻页',
        tags: ['meta'],
        payloadSchema: z.object({
          pluginName: z.string().optional(),
          cursor: z.number().int().nonnegative().optional(),
          limit: z.number().int().positive().max(DEFAULT_PAGE_SIZE).optional(),
        }),
      },
    );
  }

  if (!existing.has('get_hook_info')) {
    hookBus.register(
      'get_hook_info',
      (event) => {
        const payload = (event.payload ?? {}) as { hookNames?: string[] };
        const want = new Set(payload.hookNames ?? []);
        const items: Array<{
          name: string;
          description: string | null;
          tags: string[];
          pluginName: string | null;
          payloadSchema: unknown | null;
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
          });
        }
        return { status: 'success', data: { items } };
      },
      {
        description:
          '批量获取 hook 的描述/tags/payload JSON Schema (从 Zod 派生), 不传 hookNames 则返回全部',
        tags: ['meta'],
        payloadSchema: z.object({
          hookNames: z.array(z.string()).optional(),
        }),
      },
    );
  }
}

/**
 * 把 hook-rpc 协议挂到一个已建立的 socket-client 上。
 * @description 监听 hook:call, 维护 in-flight Map, 推 ack 后启 3s tick 推 progress, 结果用 hook:result 回包。
 *              重复挂载安全: 通过 socket 已绑定标记避免双注册。
 *              envelope.context 透传给 hookBus.emit, 让 handler 通过 event.context 读 token 等环境信息。
 * @keyword-en attach-hook-rpc
 */
export function attachHookRpc(socket: Socket, hookBus: RunnerHookBusService): void {
  type AnnotatedSocket = Socket & { __hookRpcAttached?: boolean };
  const s = socket as AnnotatedSocket;
  if (s.__hookRpcAttached) return;
  s.__hookRpcAttached = true;

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
      const results = await hookBus.emit({
        name: envelope.hookName,
        payload: envelope.payload,
        context: envelope.context,
      });
      reply = adaptResults(
        results as unknown as Array<{ status: string; data?: unknown; error?: string }>,
      );
      // debug / debugDb :: 占位, 后续接入 OTel sandbox + Mongo shadow (Phase 2)
      if (envelope.debug) {
        reply.debugLog.push({ level: 'info', msg: 'debug-trace placeholder, OTel pending' });
      }
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
