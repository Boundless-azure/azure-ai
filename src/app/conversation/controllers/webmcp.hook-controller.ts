import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  HookController,
  HookRoute,
} from '@/core/hookbus/decorators/hook-controller.decorator';
import { HookResultStatus } from '@/core/hookbus/enums/hook.enums';
import { CheckAbility } from '@/app/identity/decorators/check-ability.decorator';
import type { HookResult } from '@/core/hookbus/types/hook.types';
import { WebMcpGateway } from './webmcp.gateway';
import { WebMcpSessionDataService } from '../services/webmcp-session-data.service';

/**
 * @title WebMCP Hook payload schema (SSOT)
 * @description WebMCP 页面控制 hook 的单对象 payload schema。
 * @keywords-cn WebMCPHook, payloadSchema, SSOT
 * @keywords-en webmcp-hook, payload-schema, ssot
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
 * @title WebMCP Hook 声明层
 * @description WebMCP 页面控制 hook 的声明层 (单对象 payload); 从 WebMcpGateway 迁出, WebSocket 网关与 hook 解耦。
 *   委托 WebMcpGateway 的内存 socket 映射 + WebMcpSessionDataService 落库数据。
 * @keywords-cn WebMCPHook声明, 单对象payload, 页面控制
 * @keywords-en webmcp-hook-controller, single-object-payload, web-control
 */
@Injectable()
@HookController({ pluginName: 'webmcp', tags: ['conversation', 'webmcp'] })
export class WebMcpHookController {
  private readonly logger = new Logger(WebMcpHookController.name);

  constructor(
    private readonly gateway: WebMcpGateway,
    private readonly dataService: WebMcpSessionDataService,
  ) {}

  /**
   * 向前端页面发送控制指令（setData / callEmit）。
   * @keyword-cn 页面控制指令
   * @keyword-en hook-web-control
   */
  @HookRoute({
    hook: 'saas.app.conversation.webControl',
    description:
      '向前端页面发送控制指令。type=data 为设置数据, type=emit 为触发事件; timeout 默认 8000ms。前端需已连接 WebMCP, 调用前建议用 saas.app.conversation.webControlStatus 确认。',
    args: [webControlSchema],
    metadata: { tags: ['webmcp', 'control', 'call'] },
  })
  @CheckAbility('update', 'session')
  async handleWebControl(payloadInput: WebControlPayload): Promise<HookResult> {
    const { sessionId, type, payload, timeout } = payloadInput;
    const socketId = await this.gateway.resolveSocket(sessionId);
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

  /**
   * 获取指定 session 当前最新注册的页面信息。
   * @keyword-cn 页面信息读取
   * @keyword-en hook-web-control-pageinfo
   */
  @HookRoute({
    hook: 'saas.app.conversation.webControlPageinfo',
    description:
      '获取指定 session 当前注册的页面 Schema 信息（组件声明、可操作元素列表）。调用前建议先用 saas.app.conversation.webControlStatus 确认已连接。',
    args: [webControlPageInfoSchema],
    metadata: { tags: ['webmcp', 'page-info'] },
  })
  @CheckAbility('read', 'session')
  async handleWebControlPageInfo(
    payload: WebControlPageInfoPayload,
  ): Promise<HookResult> {
    const { sessionId } = payload;
    const schema = await this.dataService.getLatestSchema(sessionId);
    if (!schema) {
      return {
        status: HookResultStatus.Error,
        error: 'no schema found for session',
      };
    }
    return { status: HookResultStatus.Success, data: schema };
  }

  /**
   * 向前端请求指定 data key 的实时值。
   * @keyword-cn 前端数据实时查询
   * @keyword-en hook-web-control-data
   */
  @HookRoute({
    hook: 'saas.app.conversation.webControlData',
    description:
      '向前端实时请求指定 data key 的当前值。返回 { requested: true, dataKey, socketId }, 实际值由前端异步推送。',
    args: [webControlDataSchema],
    metadata: { tags: ['webmcp', 'data-query'] },
  })
  @CheckAbility('read', 'session')
  async handleWebControlData(
    payload: WebControlDataPayload,
  ): Promise<HookResult> {
    const { sessionId, dataKey } = payload;
    const socketId = await this.gateway.resolveSocket(sessionId);
    if (!socketId) {
      return {
        status: HookResultStatus.Error,
        error: `no active connection for session ${sessionId}`,
      };
    }

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

  /**
   * 查询指定 session 的 WebMCP 连接状态。
   * @keyword-cn 连接状态查询
   * @keyword-en hook-web-control-status
   */
  @HookRoute({
    hook: 'saas.app.conversation.webControlStatus',
    description:
      '查询指定 session 的 WebMCP 连接状态。返回 { dbLastSocketId, activeSocketId, connected: boolean }; connected=false 时无法使用 saas.app.conversation.webControl 系列指令。',
    args: [webControlStatusSchema],
    metadata: { tags: ['webmcp', 'status'] },
  })
  @CheckAbility('read', 'session')
  async handleWebControlStatus(
    payload: WebControlStatusPayload,
  ): Promise<HookResult> {
    const { sessionId } = payload;
    const dbStatus = await this.dataService.getConnStatus(sessionId);
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
}
