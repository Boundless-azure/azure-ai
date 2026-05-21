import type { RunnerHookBusService } from '../../hookbus/services/hookbus.service';
import type { HookLog, HookLogEntry } from '../../hookbus/types/hook.types';
import type { DataTouchpoint } from '../types/data-touchpoint.types';

type LogFn = (m: string, a?: Record<string, unknown>) => void;
type LogMethodMap = Record<HookLogEntry['level'], LogFn>;
interface ResultWithDebug {
  debugLog?: HookLogEntry[];
}

/**
 * @title 触点通知派发器 (主线程)
 * @description `ret.success({ notify })` 后由 executor 调本派发器, forEach touchpoint.notifyTargets 中间表 (每条 entry = sessionId + agentIds 子集).
 *              每个 session 一条消息, mentions = 该 entry.agentIds (绑定关系由触点创建时声明, 保证 mention 落在该 session 实际成员里);
 *              每个 session 成功/失败都打 OTel SpanEvent (drain 进 RunLogDoc.log), 任一失败的 session 列表返回给 executor,
 *              executor 据此把 outcome 翻 'error' + code=NOTIFY_TARGET_INVALID。
 *              鉴权主体固定 SYSTEM_NOTIFIER 'ai-notify' (principalType='official_account') — saas 端 im-message 跨群跳过 sender 成员校验,
 *              专用通道; 跟胶水 callHook 用的 createdByAgentId 主体走不同路径。
 *              traceId 由 trigger.service 透传, 让 saas 端 sendMsg 的 span 挂到触点 run span 同一 trace 上, 跨服务排查链完整。
 *              失败的 sessionId 不存独立字段, 完整轨迹在 log[] 里 (touchpoint.notify.send.failed 事件含 sessionId + message)。
 * @keywords-cn 通知派发器, 多session, 多agent-mention, sendMsg, SYSTEM_NOTIFIER, NOTIFY_TARGET_INVALID, traceId串联
 * @keywords-en touchpoint-notifier, multi-session, multi-agent-mention, sendmsg, system-notifier, notify-target-invalid, trace-linking
 */

const SEND_MSG_HOOK = 'saas.app.conversation.sendMsg';
/**
 * SYSTEM_NOTIFIER principal id (跟 saas 端 src/app/identity/constants/system-principals.ts 同步);
 * saas 端 im-message.service 识别此 sender 跨群跳过成员校验 + messageType='notification' UI 不渲染 / agent 可见
 */
const SYSTEM_NOTIFIER_PRINCIPAL = 'ai-notify';
/**
 * SYSTEM_NOTIFIER principalType, 跟 saas 端 `PrincipalType.OfficialAccount = 'official_account'` 枚举对齐。
 * (saas 端数据库存的短形式 'official' 跟 enum 长形式 'official_account' 有映射, 这里跟 enum 长形式一致)
 */
const SYSTEM_NOTIFIER_PRINCIPAL_TYPE = 'official_account';

/**
 * 派发结果; failedSessions 非空 → executor 翻 outcome='error' + code=NOTIFY_TARGET_INVALID
 * @keyword-en notify-dispatch-result
 */
export interface NotifyDispatchResult {
  totalSessions: number;
  succeededSessions: number;
  /** 失败的 session + 错误描述; 用于 executor 构造 error.message (具体 sessionId 仍在 log[] 时间轴里) */
  failedSessions: Array<{ sessionId: string; message: string }>;
}

/**
 * 派发一次触点通知:
 *  1. 校验 notifyTargets 非空 (理论上 zod 保证, 这里兜底过滤无效 entry)
 *  2. forEach entry 调 sendMsg, 每条独立 try/catch, 失败入 failedSessions 不中断
 *  3. mentions = entry.agentIds (该 session 内要 @ 的 agent 子集; 中间表保证落在 session 实际成员里)
 *  4. extras 透传到 sendMsg payload, 但 sessionId / sender / messageType / mentions / content 由框架覆盖, 防误覆盖
 *  5. context.principalId = SYSTEM_NOTIFIER 'ai-notify' (跨群跳过 sender 成员校验), 跟胶水 callHook 用的 createdByAgentId 主体不混
 *  6. traceId 透传给 hookBus, saas 端 sendMsg span 挂到触点 run span 同一 trace (跨服务排查链完整)
 *  7. 全过程打 OTel SpanEvent 作为运行历史的"通知段" log
 *  8. 中间表语义保证 mention 正确: agent 必须由触点创建者声明在该 session 的 entry.agentIds 里, 不会出现 mention 不在 session 里的 agent
 * @keyword-en dispatch-touchpoint-notify
 */
export async function dispatchTouchpointNotify(
  hookBus: RunnerHookBusService,
  touchpoint: DataTouchpoint,
  notify: { content: string; extras?: Record<string, unknown> },
  log: HookLog,
  traceId?: string,
): Promise<NotifyDispatchResult> {
  const targets = Array.isArray(touchpoint.notifyTargets)
    ? touchpoint.notifyTargets.filter(
        (t) =>
          t &&
          typeof t.sessionId === 'string' &&
          t.sessionId.length > 0 &&
          Array.isArray(t.agentIds) &&
          t.agentIds.length > 0,
      )
    : [];
  log.event('touchpoint.notify.start', {
    'touchpoint.id': touchpoint._id,
    targetCount: targets.length,
  });

  const failedSessions: NotifyDispatchResult['failedSessions'] = [];

  for (const target of targets) {
    const { sessionId, agentIds } = target;
    try {
      const results = await hookBus.emit({
        name: SEND_MSG_HOOK,
        payload: {
          // extras 放最前面, 核心字段 (sessionId/sender/messageType/mentions/content/strictMention) 覆盖, 防止胶水误覆盖
          ...(notify.extras ?? {}),
          sessionId,
          senderPrincipalId: SYSTEM_NOTIFIER_PRINCIPAL,
          messageType: 'notification',
          mentions: agentIds,
          content: notify.content,
          // 严格 mention 成员校验: 任一 agent 不在 session → saas 端 throw → outcome=error code=NOTIFY_TARGET_INVALID;
          // 配合后续纠错机制 (按 error.message 里的 principalId+sessionId parse 出错配信息)
          strictMention: true,
        },
        context: {
          source: 'system',
          principalId: SYSTEM_NOTIFIER_PRINCIPAL,
          principalType: SYSTEM_NOTIFIER_PRINCIPAL_TYPE,
          ...(traceId ? { traceId } : {}),
          extras: { touchpointId: touchpoint._id },
        },
      });
      // 回填 saas 端 sendMsg handler 的 OTel debugLog 到本地 session.log
      // → drain 后整条 runLog.log[] 里能看到 saas 端内部细节 (session 不存在 / mention 校验失败的堆栈等), 跨服务诊断完整
      const logMethods = log as unknown as LogMethodMap;
      for (const r of (results ?? []) as ResultWithDebug[]) {
        if (!r.debugLog || r.debugLog.length === 0) continue;
        for (const entry of r.debugLog) {
          const fn = logMethods[entry.level];
          if (typeof fn === 'function') {
            fn(`saas.${entry.message}`, { ...(entry.attrs ?? {}), sessionId });
          }
        }
      }
      const errors = results?.filter((r) => r.status === 'error') ?? [];
      if (errors.length > 0) {
        const message = errors[0]?.error ?? 'sendMsg returned error';
        log.event('touchpoint.notify.send.failed', { sessionId, message });
        failedSessions.push({ sessionId, message });
      } else {
        log.event('touchpoint.notify.send.success', { sessionId });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      log.event('touchpoint.notify.send.failed', { sessionId, message });
      failedSessions.push({ sessionId, message });
    }
  }

  const totalSessions = targets.length;
  const succeededSessions = totalSessions - failedSessions.length;
  log.event('touchpoint.notify.done', {
    totalSessions,
    succeededSessions,
    failedSessions: failedSessions.length,
  });
  return {
    totalSessions,
    succeededSessions,
    failedSessions,
  };
}
