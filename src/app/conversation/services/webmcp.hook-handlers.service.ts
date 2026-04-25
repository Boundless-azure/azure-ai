import { Injectable, Logger } from '@nestjs/common';
import { HookHandler } from '@/core/hookbus/decorators/hook-handler.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import type { HookEvent, HookResult } from '@/core/hookbus/types/hook.types';
import { WebMcpGateway } from '../controllers/webmcp.gateway';
import { WebMcpSessionDataService } from '../services/webmcp-session-data.service';

/**
 * @title WebMCP Hook 处理器
 * @description 提供 WebMCP 远程页面控制、数据获取、状态查询能力，
 *              通过 Socket.IO 与已连接的前端页面通信。
 * @keywords-cn WebMCPHook, 页面控制, 数据查询, 连接状态
 * @keywords-en webmcp-hooks, web-control, page-info, data-query, conn-status
 */
@Injectable()
export class WebMcpHookHandlersService {
  private readonly logger = new Logger(WebMcpHookHandlersService.name);

  constructor(
    private readonly gateway: WebMcpGateway,
    private readonly dataService: WebMcpSessionDataService,
  ) { }

  // ----------------------------------------------------------------
  // web_control — 向前端发送 data/emit 调用
  // ----------------------------------------------------------------

  /**
   * 向前端页面发送控制指令（setData / callEmit）
   * payload: { sessionId: string; type: 'data' | 'emit'; payload: unknown }
   * @keyword-en hook-web-control
   */
  @HookHandler('web_control', {
    pluginName: 'webmcp',
    tags: ['webmcp', 'control', 'call'],
    description: '向前端页面发送控制指令。payload: { sessionId: string, type: "data" | "emit", payload: unknown, timeout?: number }。sessionId 和 type 必填；type=data 为设置数据，type=emit 为触发事件；timeout 可选（默认 8000ms）。前端需已连接 WebMCP。',
  })
  async handleWebControl(
    event: HookEvent<{ sessionId?: string; type?: 'data' | 'emit'; payload?: unknown; timeout?: number }>,
  ): Promise<HookResult> {
    const { sessionId, type, payload, timeout } = event.payload ?? {};

    if (!sessionId || !type) {
      return { status: HookResultStatus.Error, error: 'sessionId and type are required' };
    }
    if (type !== 'data' && type !== 'emit') {
      return { status: HookResultStatus.Error, error: 'type must be "data" or "emit"' };
    }

    const socketId = await this._resolveSocket(sessionId);
    if (!socketId) {
      return { status: HookResultStatus.Error, error: `no active connection for session ${sessionId}` };
    }

    try {
      const result = await this.gateway.sendCallAndWait(
        socketId,
        { type, payload },
        typeof timeout === 'number' ? timeout : 8000,
      );
      this.logger.debug(`[web_control] ok type=${type} session=${sessionId}`);
      return { status: HookResultStatus.Success, data: { result, socketId } };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { status: HookResultStatus.Error, error: msg };
    }
  }

  // ----------------------------------------------------------------
  // web_control_pageinfo — 获取最新页面信息（来自 Schema）
  // ----------------------------------------------------------------

  /**
   * 获取指定 session 当前最新注册的页面信息
   * payload: { sessionId: string }
   * @keyword-en hook-web-control-pageinfo
   */
  @HookHandler('web_control_pageinfo', {
    pluginName: 'webmcp',
    tags: ['webmcp', 'page-info'],
    description: '获取指定 session 当前注册的页面 Schema 信息（组件声明、可操作元素列表）。payload: { sessionId: string }。sessionId 必填。调用前建议先用 web_control_status 确认已连接。',
  })
  async handleWebControlPageInfo(
    event: HookEvent<{ sessionId?: string }>,
  ): Promise<HookResult> {
    const { sessionId } = event.payload ?? {};
    if (!sessionId) return { status: HookResultStatus.Error, error: 'sessionId required' };

    const schema = await this.dataService.getLatestSchema(sessionId);
    if (!schema) return { status: HookResultStatus.Error, error: 'no schema found for session' };

    return { status: HookResultStatus.Success, data: schema };
  }

  // ----------------------------------------------------------------
  // web_control_data — 实时获取前端某个 data key 的当前值
  // ----------------------------------------------------------------

  /**
   * 向前端请求指定 data key 的实时值，前端通过 webmcp:call 接收并回传
   * payload: { sessionId: string; dataKey: string }
   * @keyword-en hook-web-control-data
   */
  @HookHandler('web_control_data', {
    pluginName: 'webmcp',
    tags: ['webmcp', 'data-query'],
    description: '向前端实时请求指定 data key 的当前值。payload: { sessionId: string, dataKey: string }。sessionId 和 dataKey 必填。返回 { requested: true, dataKey, socketId }，实际值由前端异步推送。',
  })
  async handleWebControlData(
    event: HookEvent<{ sessionId?: string; dataKey?: string }>,
  ): Promise<HookResult> {
    const { sessionId, dataKey } = event.payload ?? {};
    if (!sessionId || !dataKey) {
      return { status: HookResultStatus.Error, error: 'sessionId and dataKey are required' };
    }

    const socketId = await this._resolveSocket(sessionId);
    if (!socketId) {
      return { status: HookResultStatus.Error, error: `no active connection for session ${sessionId}` };
    }

    // 向前端发送 data 读取指令（op: callEmit 特殊 key $sys.page_data$ 或指定 key）
    const sent = this.gateway.sendCall(socketId, {
      type: 'data',
      payload: { op: 'getData', key: dataKey },
    });

    if (!sent) {
      return { status: HookResultStatus.Error, error: 'socket not found or disconnected' };
    }

    return { status: HookResultStatus.Success, data: { requested: true, dataKey, socketId } };
  }

  // ----------------------------------------------------------------
  // web_control_status — 查询 MCP 连接情况
  // ----------------------------------------------------------------

  /**
   * 查询指定 session 的 WebMCP 连接状态
   * payload: { sessionId: string }
   * @keyword-en hook-web-control-status
   */
  @HookHandler('web_control_status', {
    pluginName: 'webmcp',
    tags: ['webmcp', 'status'],
    description: '查询指定 session 的 WebMCP 连接状态。payload: { sessionId: string }。sessionId 必填。返回 { dbLastSocketId, activeSocketId, connected: boolean }；connected=false 时无法使用 web_control 系列指令。',
  })
  async handleWebControlStatus(
    event: HookEvent<{ sessionId?: string }>,
  ): Promise<HookResult> {
    const { sessionId } = event.payload ?? {};
    if (!sessionId) return { status: HookResultStatus.Error, error: 'sessionId required' };

    const dbStatus = await this.dataService.getConnStatus(sessionId);
    // 实时 socket 状态（内存）
    const activeSocketId = this.gateway.getSocketIdBySession(sessionId);

    return {
      status: HookResultStatus.Success,
      data: {
        sessionId,
        dbLastSocketId: dbStatus.socketId,
        activeSocketId: activeSocketId ?? null,
        connected: activeSocketId !== null,
        hasSchema: (await this.dataService.getLatestSchema(sessionId)) !== null,
      },
    };
  }

  // ----------------------------------------------------------------
  // 私有
  // ----------------------------------------------------------------

  /**
   * 优先从内存映射获取最新 socketId，否则回退到 DB
   * @keyword-en resolve-socket-id
   */
  private async _resolveSocket(sessionId: string): Promise<string | null> {
    const memSocket = this.gateway.getSocketIdBySession(sessionId);
    if (memSocket) return memSocket;
    return this.dataService.getLatestConn(sessionId);
  }
}
