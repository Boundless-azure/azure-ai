import { Body, Controller, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import type { Request } from 'express';
import { HookSnapshotService } from '../services/hook-snapshot.service';

const hookSnapshotBodySchema = z.object({
  hookName: z.string(),
  payload: z.unknown().optional(),
  /** 组件所属消息 id;缺省则不缓存,纯实时路由 */
  messageId: z.string().optional(),
  /** true 则每次实时拉、不读不写快照 */
  live: z.boolean().optional(),
});

type HookSnapshotBody = z.infer<typeof hookSnapshotBodySchema>;
type AuthedReq = Request & { user?: { id?: string; type?: string } };

/**
 * @title Hook Snapshot 控制器
 * @description 前端 Web Component 组件经此端点按 hookName 调用 Hook,带消息锚定的写一次快照缓存。
 *              取代组件直连 /hook-invoke:首个请求即冻结进 message.metadata,后续命中返回冻结快照(可追溯)。
 *              鉴权与 /hook-invoke 同款:全局 JwtAuthGuard,context.source='http' 携 JWT;
 *              具体 hook 的 ability 由 HookBus 中间件按链路兜底。
 * @keywords-cn hook快照端点, 前端组件, 写一次缓存, 消息锚定
 * @keywords-en hook-snapshot-endpoint, frontend-component-call, write-once-cache, message-anchored
 */
@Controller('hook-snapshot')
export class HookSnapshotController {
  constructor(private readonly snapshotService: HookSnapshotService) {}

  /**
   * 按 hookName 调用 Hook,命中冻结快照直接返回,否则实时路由并写一次快照。
   * @keyword-en invoke-hook-with-snapshot
   */
  @Post()
  async invoke(@Body() body: HookSnapshotBody, @Req() req: AuthedReq) {
    const parsed = hookSnapshotBodySchema.safeParse(body);
    if (!parsed.success) {
      return { ok: false, errorMsg: 'invalid body: ' + parsed.error.message };
    }
    const { hookName, payload, messageId, live } = parsed.data;
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');

    const result = await this.snapshotService.callWithSnapshot({
      messageId,
      hookName,
      payload,
      live,
      context: {
        token,
        principalId: req.user?.id,
        principalType: req.user?.type,
      },
    });
    return result;
  }
}
