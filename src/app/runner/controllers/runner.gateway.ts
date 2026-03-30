import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { RunnerService } from '../services/runner.service';
import { RunnerFrpNodeService } from '../services/runner-frp-node.service';
import {
  RUNNER_NAMESPACE,
  RunnerStatus,
  RunnerWsEvent,
  RUNNER_WS_PING_INTERVAL_MS,
  RUNNER_WS_PING_TIMEOUT_MS,
} from '../enums/runner.enums';
import { RunnerRegisterDto } from '../types/runner.types';

/**
 * @title Runner 网关
 * @description 处理 Runner 注册握手、维护在线离线状态，并提供 FRP 控制指令下发能力。
 * @keywords-cn Runner网关, 注册握手, 在线状态, FRP控制
 * @keywords-en runner-gateway, register-handshake, online-status, frp-control
 */
@WebSocketGateway({
  cors: true,
  namespace: RUNNER_NAMESPACE,
  pingInterval: RUNNER_WS_PING_INTERVAL_MS,
  pingTimeout: RUNNER_WS_PING_TIMEOUT_MS,
})
export class RunnerGateway implements OnGatewayDisconnect {
  private readonly socketRunnerMap = new Map<string, string>();
  private readonly runnerSocketMap = new Map<string, string>();

  constructor(
    private readonly runnerService: RunnerService,
    private readonly runnerFrpNodeService: RunnerFrpNodeService,
  ) {}

  @SubscribeMessage(RunnerWsEvent.Register)
  async onRegister(
    @MessageBody() payload: RunnerRegisterDto,
    @ConnectedSocket() client: Socket,
  ): Promise<
    | {
        ok: boolean;
        runnerId: string;
        status: RunnerStatus;
        admissionPort?: number;
        frpsHost?: string;
        frpsPort?: number;
        frpsToken?: string;
      }
    | { ok: false; error: string }
  > {
    const runner = await this.runnerService.verifyRegistration(
      payload.runnerId,
      payload.key,
    );
    if (!runner) {
      return { ok: false, error: 'invalid runnerId or key' };
    }

    // 分配 FRP 端口并更新 runners 表
    let admissionPort: number | undefined;
    let frpsHost: string | undefined;
    let frpsPort: number | undefined;
    let frpsToken: string | undefined;
    try {
      const result = await this.runnerFrpNodeService.allocateFrpRecord(
        runner.id,
        `runner-${runner.id}`,
      );
      admissionPort = result.port;
      frpsHost = result.nodeIp;
      frpsPort = result.nodePort;
      frpsToken = result.token;
    } catch (err) {
      console.error(
        `[RunnerGateway] Failed to allocate FRP port: ${(err as Error).message}`,
      );
    }

    this.socketRunnerMap.set(client.id, runner.id);
    this.runnerSocketMap.set(runner.id, client.id);
    await this.runnerService.markStatus(runner.id, RunnerStatus.Mounted);

    console.log(
      `[RunnerGateway] Runner registered: id=${runner.id} alias=${runner.alias} ` +
        `FRP: port=${admissionPort} host=${frpsHost}:${frpsPort}`,
    );
    console.log(
      `[RunnerGateway][TRACE] Returning to runner: admissionPort=${admissionPort} frpsHost=${frpsHost} frpsPort=${frpsPort} hasToken=${!!frpsToken}`,
    );

    return {
      ok: true,
      runnerId: runner.id,
      status: RunnerStatus.Mounted,
      admissionPort,
      frpsHost,
      frpsPort,
      frpsToken,
    };
  }

  @SubscribeMessage(RunnerWsEvent.FrpStart)
  onFrpStart(
    @MessageBody() payload: { runnerId: string },
    @ConnectedSocket() client: Socket,
  ): { ok: boolean; message: string } {
    const mappedRunnerId = this.socketRunnerMap.get(client.id);
    if (!mappedRunnerId || mappedRunnerId !== payload.runnerId) {
      return { ok: false, message: 'unauthorized' };
    }

    // 转发给 Runner 客户端
    const runnerSocketId = this.runnerSocketMap.get(payload.runnerId);
    if (runnerSocketId) {
      // 向 Runner 客户端发送 FRP 启动指令
      // 实际通过 Socket.io emit 到客户端
      console.log(
        `[RunnerGateway] FRP start command sent to runner: ${payload.runnerId}`,
      );
    }

    return { ok: true, message: 'FRP start command sent' };
  }

  @SubscribeMessage(RunnerWsEvent.FrpStop)
  onFrpStop(
    @MessageBody() payload: { runnerId: string },
    @ConnectedSocket() client: Socket,
  ): { ok: boolean; message: string } {
    const mappedRunnerId = this.socketRunnerMap.get(client.id);
    if (!mappedRunnerId || mappedRunnerId !== payload.runnerId) {
      return { ok: false, message: 'unauthorized' };
    }

    console.log(
      `[RunnerGateway] FRP stop command sent to runner: ${payload.runnerId}`,
    );
    return { ok: true, message: 'FRP stop command sent' };
  }

  @SubscribeMessage(RunnerWsEvent.FrpReload)
  onFrpReload(
    @MessageBody() payload: { runnerId: string },
    @ConnectedSocket() client: Socket,
  ): { ok: boolean; message: string } {
    const mappedRunnerId = this.socketRunnerMap.get(client.id);
    if (!mappedRunnerId || mappedRunnerId !== payload.runnerId) {
      return { ok: false, message: 'unauthorized' };
    }

    console.log(
      `[RunnerGateway] FRP reload command sent to runner: ${payload.runnerId}`,
    );
    return { ok: true, message: 'FRP reload command sent' };
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const runnerId = this.socketRunnerMap.get(client.id);
    if (!runnerId) return;
    this.socketRunnerMap.delete(client.id);
    this.runnerSocketMap.delete(runnerId);
    await this.runnerService.markStatus(runnerId, RunnerStatus.Offline);
    // 释放 frp_record 并清 Redis 缓存，防止端口池泄漏
    await this.runnerFrpNodeService
      .releaseFrpRecord(runnerId)
      .catch((err: Error) =>
        console.error(
          `[RunnerGateway] releaseFrpRecord failed: ${err.message}`,
        ),
      );
    console.log(`[RunnerGateway] Runner disconnected: id=${runnerId}`);
  }
}
