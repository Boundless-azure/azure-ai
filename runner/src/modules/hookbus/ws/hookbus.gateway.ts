import type { Server, Socket } from 'socket.io';
import { RunnerHookBusService } from '../services/hookbus.service';
import { getRunnerConfig } from '../../../config/store';

/**
 * @title HookBus Socket Gateway
 * @description 暴露 HookBus 注册信息与调试事件到 Socket.IO /hookbus。
 * @keywords-cn HookBus网关, Socket.IO, 调试输出
 * @keywords-en hookbus-gateway, socket-io, debug-output
 */
export function registerHookBusGateway(
  io: Server,
  hookBus: RunnerHookBusService,
): void {
  io.on('connection', (socket: Socket) => {
    if (!getRunnerConfig().hookbusDebugEnabled) {
      socket.emit('hookbus/debug_disabled', {
        ok: false,
        message: 'hookbus debug is disabled',
        ts: Date.now(),
      });
      socket.disconnect();
      return;
    }
    const key = socket.handshake.auth?.key ?? socket.handshake.query?.key;
    const emitRegistrations = () => {
      socket.emit('hookbus/registrations', {
        ok: true,
        items: hookBus.listRegistrations().map((item) => ({
          name: item.name,
          metadata: item.metadata ?? null,
        })),
        connectedWithKey: Boolean(key),
        ts: Date.now(),
      });
    };
    emitRegistrations();
    socket.on('hookbus/list', () => emitRegistrations());
    socket.on(
      'hookbus/emit',
      async (
        payload: { name?: string; payload?: unknown },
        cb?: (resp: {
          ok: boolean;
          results?: unknown;
          message?: string;
          hookName?: string;
          handlerCount?: number;
          ts: number;
        }) => void,
      ) => {
        if (!payload?.name) {
          cb?.({
            ok: false,
            message: 'hook name is required',
            ts: Date.now(),
          });
          return;
        }
        const handlerCount = hookBus
          .listRegistrations()
          .filter((item) => item.name === payload.name).length;
        if (handlerCount === 0) {
          cb?.({
            ok: false,
            message: 'no hook handlers registered for this hook',
            hookName: payload.name,
            handlerCount,
            ts: Date.now(),
          });
          return;
        }
        const results = await hookBus.emit({
          name: payload.name,
          payload: payload.payload,
        });
        cb?.({
          ok: true,
          hookName: payload.name,
          handlerCount,
          results,
          ts: Date.now(),
        });
      },
    );
    const unsubscribe = hookBus.onDebug((event) => {
      socket.emit('hookbus/debug', {
        ...event,
        ts: event.ts,
        debugType: 'runner-hookbus',
      });
    });
    socket.on('disconnect', () => {
      unsubscribe();
    });
  });
}
