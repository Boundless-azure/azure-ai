/**
 * @title useWebMCP
 * @description 前端组合函数：页面声明、Socket 连接与操作派发。
 * @keywords-cn WebMCP, 连接, 注册, 操作
 * @keywords-en webmcp, connect, register, operation
 */
import { ref } from 'vue';
import { io, type Socket } from 'socket.io-client';
import { z } from 'zod';
import type {
  WebMcpPageDeclaration,
  WebMcpWirePageDeclaration,
  WebMcpHookItem,
  WebMcpOperation,
  WebMcpOpResult,
} from '../types/webmcp.types';
import {
  WEBMCP_EVENT_NAMES,
  WEBMCP_NAMESPACE,
  WEBMCP_SOCKET_PATH,
} from '../constants/webmcp.constants';

export function useWebMCP() {
  const connected = ref(false);
  const error = ref<string | null>(null);

  let pageDecl: WebMcpPageDeclaration | undefined;
  const hookMap = new Map<string, WebMcpHookItem>();
  let socket: Socket | undefined;

  const buildPointer = (page: string, hookname: string) =>
    `${page}::${hookname}`;

  const indexHooks = (decl: WebMcpPageDeclaration) => {
    const hooks = decl.hook ?? [];
    for (const h of hooks) {
      const pointer = buildPointer(decl.page, h.hookname);
      hookMap.set(pointer, h);
    }
    const children = decl.childPage ?? [];
    for (const c of children) indexHooks(c);
  };

  const toWire = (
    decl?: WebMcpPageDeclaration,
  ): WebMcpWirePageDeclaration | null => {
    const d = decl ?? pageDecl;
    if (!d) return null;
    return {
      page: d.page,
      desc: d.desc,
      keyword: d.keyword,
      data: d.data?.slice() ?? [],
      hook: (d.hook ?? []).map((h) => ({
        hookname: h.hookname,
        keyword: h.keyword,
        pointer: buildPointer(d.page, h.hookname),
        desc: h.desc,
      })),
      childPage: (d.childPage ?? []).map((c) => toWire(c)).filter(Boolean),
    } as WebMcpWirePageDeclaration;
  };

  const execute = async (
    op: WebMcpOperation,
  ): Promise<{ ok: boolean; error?: string }> => {
    if (op.op === 'callHook') {
      const h = hookMap.get(op.pointer);
      if (!h) return { ok: false, error: 'hook-not-found' };
      try {
        await Promise.resolve(h.action());
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      return { ok: true };
    }
    if (op.op === 'setData') {
      return { ok: true };
    }
    return { ok: false, error: 'unsupported-op' };
  };

  function declarePage(decl: WebMcpPageDeclaration) {
    pageDecl = decl;
    hookMap.clear();
    indexHooks(decl);
    window.dispatchEvent(new CustomEvent(WEBMCP_EVENT_NAMES.descriptorUpdated));
  }

  function connect(baseUrl?: string) {
    try {
      const parsedBase = z
        .string()
        .url()
        .or(z.string().startsWith('http'))
        .safeParse(baseUrl ?? window.location.origin);
      const safeBase = parsedBase.success
        ? parsedBase.data
        : window.location.origin;
      socket = io(`${safeBase}${WEBMCP_NAMESPACE}`, {
        path: WEBMCP_SOCKET_PATH,
        transports: ['websocket'],
        withCredentials: true,
      });

      socket.on('connect_error', (err) => {
        error.value = err?.message ?? 'connect error';
      });

      socket.on('webmcp/get', (payload: { page?: string }) => {
        const parsedPayload = z
          .object({ page: z.string().optional() })
          .safeParse(payload);
        if (!parsedPayload.success) return;
        const wire = toWire();
        if (!wire) return;
        if (parsedPayload.data.page && parsedPayload.data.page !== wire.page)
          return;
        socket!.emit('webmcp/descriptor', {
          page: wire.page,
          descriptor: wire,
          ts: Date.now(),
        });
      });

      socket.on('webmcp/op', async (op: WebMcpOperation) => {
        const parsedOp = z
          .discriminatedUnion('op', [
            z.object({
              op: z.literal('callHook'),
              pointer: z.string(),
              args: z.any().optional(),
            }),
            z.object({
              op: z.literal('setData'),
              page: z.string(),
              keyword: z.array(z.string()),
              value: z.any(),
              path: z.string().optional(),
            }),
          ])
          .safeParse(op);
        if (!parsedOp.success) return;
        const result = await execute(parsedOp.data as WebMcpOperation);
        const resp: WebMcpOpResult = { ok: result.ok, error: result.error };
        socket!.emit('webmcp/op_result', resp);
      });

      connected.value = true;
      window.dispatchEvent(new CustomEvent(WEBMCP_EVENT_NAMES.connected));
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'connect failed';
      connected.value = false;
    }
  }

  function registerCurrentPage() {
    const wire = toWire();
    if (!wire || !socket) return;
    socket.emit('webmcp/register', { page: wire.page, descriptor: wire });
  }

  return { connected, error, declarePage, connect, registerCurrentPage };
}
