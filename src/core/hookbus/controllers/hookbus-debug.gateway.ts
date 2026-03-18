import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { HookBusService } from '../services/hook.bus.service';
import { HookDebugStateService } from '../services/hook.debug-state.service';

/**
 * @title HookBus 调试网关
 * @description 通过 /hookbus 暴露 Hook 列表、调试触发与实时调试事件。
 * @keywords-cn hookbus网关, socket调试, hook列表
 * @keywords-en hookbus-gateway, socket-debug, hook-list
 */
@WebSocketGateway({
  cors: true,
  path: '/hookbus',
})
export class HookbusDebugGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly hookBus: HookBusService,
    private readonly state: HookDebugStateService,
  ) {}

  afterInit(): void {
    this.hookBus.onDebug((event) => {
      this.server.emit('hookbus/debug', {
        ...event,
        debugType: 'saas-hookbus',
      });
    });
  }

  @SubscribeMessage('hookbus/list')
  onList(@ConnectedSocket() socket: Socket) {
    if (!this.state.getEnabled()) {
      socket.emit('hookbus/debug_disabled', {
        ok: false,
        message: 'hookbus debug is disabled',
        ts: Date.now(),
      });
      return;
    }
    const key = socket.handshake.auth?.key ?? socket.handshake.query?.key;
    socket.emit('hookbus/registrations', {
      ok: true,
      items: this.hookBus.listRegistrations().map((item) => ({
        name: item.name,
        metadata: item.metadata ?? null,
      })),
      connectedWithKey: Boolean(key),
      ts: Date.now(),
    });
  }

  @SubscribeMessage('hookbus/emit')
  async onEmit(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { name?: string; payload?: unknown },
  ) {
    if (!this.state.getEnabled()) {
      socket.emit('hookbus/debug_disabled', {
        ok: false,
        message: 'hookbus debug is disabled',
        ts: Date.now(),
      });
      return {
        ok: false,
        message: 'hookbus debug is disabled',
        ts: Date.now(),
      };
    }
    if (!payload?.name) {
      return { ok: false, message: 'hook name is required', ts: Date.now() };
    }
    const handlerCount = this.hookBus.select(payload.name).length;
    if (handlerCount === 0) {
      return {
        ok: false,
        message: 'no hook handlers registered for this hook',
        hookName: payload.name,
        handlerCount,
        ts: Date.now(),
      };
    }
    const results = await this.hookBus.emit({
      name: payload.name,
      payload: payload.payload,
    });
    return {
      ok: true,
      hookName: payload.name,
      handlerCount,
      results,
      ts: Date.now(),
    };
  }
}
