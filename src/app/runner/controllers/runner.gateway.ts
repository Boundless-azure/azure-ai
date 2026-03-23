import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { RunnerService } from '../services/runner.service';
import { RunnerFrpService } from '../services/runner-frp.service';
import {
  RUNNER_NAMESPACE,
  RunnerStatus,
  RUNNER_WS_PING_INTERVAL_MS,
  RUNNER_WS_PING_TIMEOUT_MS,
  RunnerWsEvent,
} from '../enums/runner.enums';
import { RunnerRegisterDto } from '../types/runner.types';

/**
 * @title Runner 网关
 * @description 处理 Runner 注册握手并维护在线离线状态。
 * @keywords-cn Runner网关, 注册握手, 在线状态
 * @keywords-en runner-gateway, register-handshake, online-status
 */
@WebSocketGateway({
  cors: true,
  namespace: RUNNER_NAMESPACE,
  pingInterval: RUNNER_WS_PING_INTERVAL_MS,
  pingTimeout: RUNNER_WS_PING_TIMEOUT_MS,
})
export class RunnerGateway implements OnGatewayDisconnect {
  private readonly socketRunnerMap = new Map<string, string>();

  constructor(
    private readonly runnerService: RunnerService,
    private readonly runnerFrpService: RunnerFrpService,
  ) {}

  @SubscribeMessage(RunnerWsEvent.Register)
  async onRegister(
    @MessageBody() payload: RunnerRegisterDto,
    @ConnectedSocket() client: Socket,
  ): Promise<
    | { ok: boolean; runnerId: string; status: RunnerStatus; admissionPort?: number; frpsHost?: string; frpsPort?: number }
    | { ok: false; error: string }
  > {
    const runner = await this.runnerService.verifyRegistration(
      payload.runnerId,
      payload.key,
    );
    if (!runner) {
      return { ok: false, error: 'invalid runnerId or key' };
    }

    // 分配 FRP 端口
    let admissionPort: number | undefined;
    try {
      admissionPort = await this.runnerFrpService.allocatePort(runner.id, `runner-${runner.id}`);
    } catch (err) {
      console.error('[RunnerGateway] Failed to allocate FRP port:', err);
    }

    this.socketRunnerMap.set(client.id, runner.id);
    await this.runnerService.markStatus(runner.id, RunnerStatus.Mounted);

    return {
      ok: true,
      runnerId: runner.id,
      status: RunnerStatus.Mounted,
      admissionPort,
      frpsHost: process.env.FRPS_HOST || 'localhost',
      frpsPort: 7000,
    };
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const runnerId = this.socketRunnerMap.get(client.id);
    if (!runnerId) return;
    this.socketRunnerMap.delete(client.id);
    await this.runnerService.markStatus(runnerId, RunnerStatus.Offline);
  }
}
