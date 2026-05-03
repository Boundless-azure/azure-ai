import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { HookHandler } from '@/core/hookbus/decorators/hook-handler.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import type { HookEvent, HookResult } from '@/core/hookbus/types/hook.types';
import { WebMcpGateway } from '../controllers/webmcp.gateway';
import { WebMcpSessionDataService } from '../services/webmcp-session-data.service';

/**
 * @title WebMCP Hook payload schema (SSOT)
 * @description 单一来源: schema 给 LLM 用作 JSONSchema 派生 + 运行时校验, type 由 z.infer 派生供 handler 签名复用。
 * @keywords-cn WebMCPHook, payloadSchema, SSOT, zod-infer
 * @keywords-en webmcp-hook, payload-schema, ssot, zod-infer
 */
const webControlSchema = z.object({
  sessionId: z.string().describe('目标会话 ID, 必填'),
  type: z
    .enum(['data', 'emit'])
    .describe('指令类型: data=设置数据, emit=触发事件'),
  payload: z
    .unknown()
    .describe('指令载荷, type=data 时为待写入数据, type=emit 时为事件参数'),
  timeout: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('等待前端响应的超时, 默认 8000ms'),
});

const webControlPageInfoSchema = z.object({
  sessionId: z.string().describe('目标会话 ID, 必填'),
});

const webControlDataSchema = z.object({
  sessionId: z.string().describe('目标会话 ID, 必填'),
  dataKey: z.string().describe('要读取的前端 data key, 必填'),
});

const webControlStatusSchema = z.object({
  sessionId: z.string().describe('目标会话 ID, 必填'),
});

type WebControlPayload = z.infer<typeof webControlSchema>;
type WebControlPageInfoPayload = z.infer<typeof webControlPageInfoSchema>;
type WebControlDataPayload = z.infer<typeof webControlDataSchema>;
type WebControlStatusPayload = z.infer<typeof webControlStatusSchema>;

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
  ) {}

  // ----------------------------------------------------------------
  // saas.app.conversation.webControl — 向前端发送 data/emit 调用
  // ----------------------------------------------------------------

  /**
   * 向前端页面发送控制指令（setData / callEmit）
   * @keyword-en hook-web-control
   */
  @HookHandler('saas.app.conversation.webControl', {
    pluginName: 'webmcp',
    tags: ['webmcp', 'control', 'call'],
    description:
      '向前端页面发送控制指令。type=data 为设置数据, type=emit 为触发事件; timeout 默认 8000ms。前端需已连接 WebMCP, 调用前建议用 saas.app.conversation.webControlStatus 确认。',
    payloadSchema: webControlSchema,
  })
  @CheckAbility('update', 'session')
  async handleWebControl(
    event: HookEvent<WebControlPayload>,
  ): Promise<HookResult> {
    const { sessionId, type, payload, timeout } = event.payload;

    const socketId = await this._resolveSocket(sessionId);
    if (!socketId) {
      return {
        status: HookResultStatus.Error,
        error: `no active connection for session ${sessionId}`,
      };
    }

    try {
      const result = await this.gateway.sendCallAndWait(
        socketId,
        { type, payload },
        typeof timeout === 'number' ? timeout : 8000,
      );
      this.logger.debug(`[webControl] ok type=${type} session=${sessionId}`);
      return {
        status: HookResultStatus.Success,
        data: { result, socketId },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { status: HookResultStatus.Error, error: msg };
    }
  }

  // ----------------------------------------------------------------
  // saas.app.conversation.webControlPageinfo — 获取最新页面信息（来自 Schema）
  // ----------------------------------------------------------------

  /**
   * 获取指定 session 当前最新注册的页面信息
   * @keyword-en hook-web-control-pageinfo
   */
  @HookHandler('saas.app.conversation.webControlPageinfo', {
    pluginName: 'webmcp',
    tags: ['webmcp', 'page-info'],
    description:
      '获取指定 session 当前注册的页面 Schema 信息（组件声明、可操作元素列表）。调用前建议先用 saas.app.conversation.webControlStatus 确认已连接。',
    payloadSchema: webControlPageInfoSchema,
  })
  @CheckAbility('read', 'session')
  async handleWebControlPageInfo(
    event: HookEvent<WebControlPageInfoPayload>,
  ): Promise<HookResult> {
    const { sessionId } = event.payload;

    const schema = await this.dataService.getLatestSchema(sessionId);
    if (!schema)
      return {
        status: HookResultStatus.Error,
        error: 'no schema found for session',
      };

    return { status: HookResultStatus.Success, data: schema };
  }

  // ----------------------------------------------------------------
  // saas.app.conversation.webControlData — 实时获取前端某个 data key 的当前值
  // ----------------------------------------------------------------

  /**
   * 向前端请求指定 data key 的实时值，前端通过 webmcp:call 接收并回传
   * @keyword-en hook-web-control-data
   */
  @HookHandler('saas.app.conversation.webControlData', {
    pluginName: 'webmcp',
    tags: ['webmcp', 'data-query'],
    description:
      '向前端实时请求指定 data key 的当前值。返回 { requested: true, dataKey, socketId }, 实际值由前端异步推送。',
    payloadSchema: webControlDataSchema,
  })
  @CheckAbility('read', 'session')
  async handleWebControlData(
    event: HookEvent<WebControlDataPayload>,
  ): Promise<HookResult> {
    const { sessionId, dataKey } = event.payload;

    const socketId = await this._resolveSocket(sessionId);
    if (!socketId) {
      return {
        status: HookResultStatus.Error,
        error: `no active connection for session ${sessionId}`,
      };
    }

    // 向前端发送 data 读取指令（op: callEmit 特殊 key $sys.page_data$ 或指定 key）
    const sent = this.gateway.sendCall(socketId, {
      type: 'data',
      payload: { op: 'getData', key: dataKey },
    });

    if (!sent) {
      return {
        status: HookResultStatus.Error,
        error: 'socket not found or disconnected',
      };
    }

    return {
      status: HookResultStatus.Success,
      data: { requested: true, dataKey, socketId },
    };
  }

  // ----------------------------------------------------------------
  // saas.app.conversation.webControlStatus — 查询 MCP 连接情况
  // ----------------------------------------------------------------

  /**
   * 查询指定 session 的 WebMCP 连接状态
   * @keyword-en hook-web-control-status
   */
  @HookHandler('saas.app.conversation.webControlStatus', {
    pluginName: 'webmcp',
    tags: ['webmcp', 'status'],
    description:
      '查询指定 session 的 WebMCP 连接状态。返回 { dbLastSocketId, activeSocketId, connected: boolean }; connected=false 时无法使用 saas.app.conversation.webControl 系列指令。',
    payloadSchema: webControlStatusSchema,
  })
  @CheckAbility('read', 'session')
  async handleWebControlStatus(
    event: HookEvent<WebControlStatusPayload>,
  ): Promise<HookResult> {
    const { sessionId } = event.payload;

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
