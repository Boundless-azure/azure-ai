import { OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { RunnerService } from '../services/runner.service';
import { RunnerFrpNodeService } from '../services/runner-frp-node.service';
import { RunnerTokenService } from '../services/runner-token.service';
import { RunnerHookRpcService } from '../services/runner-hook-rpc.service';
import {
  RUNNER_NAMESPACE,
  RunnerStatus,
  RunnerWsEvent,
  RUNNER_WS_PING_INTERVAL_MS,
  RUNNER_WS_PING_TIMEOUT_MS,
} from '../enums/runner.enums';
import { HookCallReply, RunnerRegisterDto } from '../types/runner.types';

/**
 * @title Runner 网关
 * @description 处理 Runner 注册握手，维护在线离线状态，并提供 FRP 控制指令下发能力。
 * @keywords-cn Runner网关, 注册握手, 在线状态, FRP控制
 * @keywords-en runner-gateway, register-handshake, online-status, frp-control
 */
@WebSocketGateway({
  cors: true,
  namespace: RUNNER_NAMESPACE,
  pingInterval: RUNNER_WS_PING_INTERVAL_MS,
  pingTimeout: RUNNER_WS_PING_TIMEOUT_MS,
})
export class RunnerGateway implements OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  ioServer!: Server;

  private readonly socketRunnerMap = new Map<string, string>();

  /**
   * @title 启动后注入 hook RPC socket 解析器
   * @description 让 RunnerHookRpcService 能根据 runnerId 找到对应已连接的 Socket。
   * @keyword-en init-hook-resolver
   */
  onModuleInit(): void {
    this.hookRpc.setSocketResolver((runnerId) => this.findSocket(runnerId));
  }

  private findSocket(runnerId: string): Socket | undefined {
    // @ts-expect-error - sockets 是 socket.io 内部属性
    const sockets = this.ioServer?.sockets as Map<string, Socket> | undefined;
    if (!sockets) return undefined;
    for (const [socketId, mapped] of this.socketRunnerMap) {
      if (mapped !== runnerId) continue;
      const socket = sockets.get(socketId);
      // @ts-expect-error - 检查 Socket 连接状态
      if (socket && socket.connected) return socket;
    }
    return undefined;
  }

  /**
   * @title 获取所有在线 Runner ID 列表
   * @description 返回当前 WebSocket 活跃的所有 Runner ID，用于同步状态。
   *        遍历 socketRunnerMap 并检查每个 socket 是否真的连接（Socket.IO 自带连接池管理）。
   * @returns 在线 Runner ID 数组
   * @keyword-cn 获取在线Runner, ID列表
   * @keyword-en get-online-runners, id-list
   */
  getOnlineRunnerIds(): string[] {
    const onlineRunnerIds: string[] = [];
    // @ts-expect-error - sockets 是 socket.io 内部属性
    if (!this.ioServer?.sockets) return onlineRunnerIds;
    for (const [socketId, runnerId] of this.socketRunnerMap) {
      // @ts-expect-error - sockets 是 Map 类型
      const socket = (this.ioServer.sockets as Map<string, Socket>).get(
        socketId,
      );
      // @ts-expect-error - 检查 Socket 连接状态
      if (socket && socket.connected) {
        onlineRunnerIds.push(runnerId);
      }
    }
    return onlineRunnerIds;
  }

  /**
   * @title 检查单个 Runner 是否在线
   * @description 根据 runnerId 判断其 WebSocket 连接是否存活。
   * @param runnerId Runner ID
   * @returns 是否在线
   * @keyword-cn Runner在线, 单个检查
   * @keyword-en runner-online, single-check
   */
  isRunnerOnline(runnerId: string): boolean {
    // @ts-expect-error - sockets 是 socket.io 内部属性
    if (!this.ioServer?.sockets) return false;
    for (const [socketId, mappedRunnerId] of this.socketRunnerMap) {
      if (mappedRunnerId !== runnerId) continue;
      // @ts-expect-error - sockets 是 Map 类型
      const socket = (this.ioServer.sockets as Map<string, Socket>).get(
        socketId,
      );
      // @ts-expect-error - 检查 Socket 连接状态
      if (socket && socket.connected) {
        return true;
      }
    }
    return false;
  }

  constructor(
    private readonly runnerService: RunnerService,
    private readonly runnerFrpNodeService: RunnerFrpNodeService,
    private readonly tokenService: RunnerTokenService,
    private readonly hookRpc: RunnerHookRpcService,
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
    this.tokenService.registerRunner(runner.id, client.id);
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

    console.log(
      `[RunnerGateway] FRP start command sent to runner: ${payload.runnerId}`,
    );
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

  @SubscribeMessage('runner/request-token')
  async onRequestToken(
    @MessageBody() payload: { runnerId: string },
    @ConnectedSocket() _client: Socket,
  ): Promise<{
    ok: boolean;
    token?: string;
    expiresAt?: number;
    error?: string;
  }> {
    const result = await this.tokenService.requestToken(
      this.ioServer,
      payload.runnerId,
    );
    if (!result) {
      return { ok: false, error: 'runner not connected or request timeout' };
    }
    return { ok: true, token: result.token, expiresAt: result.expiresAt };
  }

  /**
   * @title 接收 Runner 回 ack
   * @description 收到 ack 表示 Runner 已收到 hook:call, in-flight 进入 stale 监控阶段。
   * @keyword-en on-hook-ack
   */
  @SubscribeMessage(RunnerWsEvent.HookAck)
  onHookAck(@MessageBody() payload: { callId: string }): void {
    if (!payload?.callId) return;
    this.hookRpc.handleAck(payload.callId);
  }

  /**
   * @title 接收 Runner 进度心跳
   * @description Runner 每 3s 合并 push in-flight callIds, 续命 stale 截止。
   * @keyword-en on-hook-progress
   */
  @SubscribeMessage(RunnerWsEvent.HookProgress)
  onHookProgress(
    @MessageBody() payload: { callIds?: string[]; ts?: number } | null,
  ): void {
    if (!payload || !Array.isArray(payload.callIds)) return;
    this.hookRpc.handleProgress({
      callIds: payload.callIds,
      ts: payload.ts ?? Date.now(),
    });
  }

  /**
   * @title 接收 Runner 终态回包
   * @description 完成对应 callId 的 in-flight, 解锁背压。
   * @keyword-en on-hook-result
   */
  @SubscribeMessage(RunnerWsEvent.HookResult)
  onHookResult(
    @MessageBody() payload: { callId: string; reply: HookCallReply },
  ): void {
    if (!payload?.callId || !payload?.reply) return;
    this.hookRpc.handleResult(payload.callId, payload.reply);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const runnerId = this.socketRunnerMap.get(client.id);
    if (!runnerId) return;
    this.socketRunnerMap.delete(client.id);
    this.tokenService.unregisterRunner(runnerId);
    this.hookRpc.cleanupRunner(runnerId);
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
