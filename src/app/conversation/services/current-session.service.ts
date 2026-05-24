import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { ChatMessage } from '@core/ai/types';
import { ChatMessageEntity } from '@core/ai/entities/chat-message.entity';
import { ChatSessionEntity } from '@core/ai/entities/chat-session.entity';
import { ChatSessionMemberEntity } from '@core/ai/entities/chat-session-member.entity';
import { ChatMessageType, ChatSessionType } from '@core/ai/enums/chat.enums';
import { PrincipalEntity } from '@/app/identity/entities/principal.entity';

/**
 * 模型偷懒 guard 的固定 markdown 标签; 前端用 data-i18n 做本地化渲染.
 * @keyword-en lazy-guard-markdown
 */
export const CURRENT_SESSION_LAZY_GUARD_MARKDOWN =
  '<agent-lazy-guard data-i18n="chat.lazyToolRequired"></agent-lazy-guard>';

/**
 * 临时 session 状态的 TTL.
 * @keyword-en current-session-ttl
 */
const CURRENT_SESSION_TTL_MS = 30 * 60 * 1000;

/**
 * 每轮最多保留的 hook 调用记录数.
 * @keyword-en current-session-hook-limit
 */
const MAX_HOOK_CALLS_PER_TURN = 80;

/**
 * init_tip 的固定判定字段; LLM 在每轮第一步声明 needKnowledge / needHook / needHistory.
 * - needHistory: 是否需要回看本会话历史消息以应答当前问题 (走 smart 三步检索链路: smartTags → smartSearch → smartMessages)
 * @keyword-en current-session-init-tip, need-history
 */
export interface CurrentSessionInitTip {
  needKnowledge: boolean;
  needHook: boolean;
  needHistory?: boolean;
  reason?: string;
}

/**
 * 参数不足时挂起的平台动作阶段.
 * @keyword-en current-session-pending-action-stage
 */
export type CurrentSessionPendingActionStage =
  | 'missing_args'
  | 'ready'
  | 'not_found';

/**
 * 参数不足或能力待确认的平台动作挂起态.
 * @keyword-en current-session-pending-action
 */
export interface CurrentSessionPendingAction {
  stage: CurrentSessionPendingActionStage;
  hookName?: string;
  domain?: string;
  action?: string;
  missingFields: string[];
  collectedFields: Record<string, unknown>;
  question?: string;
  reason?: string;
}

/**
 * 当前轮 hook 调用记录.
 * @keyword-en current-session-hook-call
 */
export interface CurrentSessionHookCall {
  hookName: string;
  ok: boolean;
  ts: number;
}

/**
 * 当前 session 临时态快照.
 * @keyword-en current-session-snapshot
 */
export interface CurrentSessionSnapshot {
  sessionId: string;
  principalId: string;
  fields: Record<string, unknown>;
  initTip: CurrentSessionInitTip | null;
  pendingAction: CurrentSessionPendingAction | null;
  hookCalls: CurrentSessionHookCall[];
}

/**
 * 当前会话上下文 :: 主体信息子段 (me / peer 共用).
 * @keyword-en current-session-context-principal
 */
export interface CurrentSessionContextPrincipal {
  principalId: string;
  principalType: string;
  displayName: string;
  tenantId: string | null;
}

/**
 * 当前会话上下文 :: peer 主体附加字段 (ip + 最近一条 peer 消息引用).
 * @keyword-en current-session-context-peer
 */
export interface CurrentSessionContextPeer extends CurrentSessionContextPrincipal {
  /** 对方客户端 IP, 从触发 sendMsg 那一端的 HTTP 请求拿; metadata.senderIp 写入 */
  ip: string | null;
  lastMessageId: string | null;
  lastMessageAt: string | null;
}

/**
 * 当前会话上下文 :: 会话元数据.
 * @keyword-en current-session-context-session
 */
export interface CurrentSessionContextSession {
  sessionId: string;
  type: string;
  name: string | null;
  creatorId: string | null;
  memberCount: number;
  members: Array<{
    principalId: string;
    displayName: string;
    principalType: string;
  }>;
}

/**
 * 当前会话上下文 :: 服务器时间.
 * @keyword-en current-session-context-time
 */
export interface CurrentSessionContextTime {
  iso: string;
  epochMs: number;
  timezone: string;
  weekday: string;
}

/**
 * 当前会话上下文完整 snapshot.
 *  - me      :: 当前 agent 自身主体
 *  - peer    :: 对方主体 (私聊另一成员 / 群聊最近触发 sender), 含 IP
 *  - session :: 会话元数据 (类型/名称/成员)
 *  - time    :: 服务器当前时间 (ISO + epoch + timezone + weekday)
 * @keyword-en current-session-context-snapshot
 */
export interface CurrentSessionContextSnapshot {
  me: CurrentSessionContextPrincipal;
  peer: CurrentSessionContextPeer | null;
  session: CurrentSessionContextSession;
  time: CurrentSessionContextTime;
}

/**
 * init_tip tool 返回给 LLM 的 turn 使用手册.
 *  - directHooks :: 已知常用 hook 的快捷入口, 不需要走发现链路 (例如 currentSession.context 一次拿双方身份/IP/时间)
 *  - discoveryChains :: 三大标准发现链路 (callLog / knowledge / hook), 每条按 tag → search → detail 顺序走, 末尾收 sendMsg
 *  - usageRules :: cross-cutting 行为约束 (commit early / no loops / no skip / must sendMsg)
 *  - tipNote :: 一句话本轮总览, 按 declared 强调走哪条
 * @keyword-en init-tip-suggestions, direct-hooks, discovery-chains, usage-rules
 */
export interface CurrentSessionInitTipSuggestions {
  directHooks: string[];
  discoveryChains: {
    callLog: string[];
    knowledge: string[];
    hook: string[];
    /** 会话历史 smart 三步检索: 用于回答"我们之前聊到/我说过/上次说的..."等需要回看历史的问题 */
    history: string[];
  };
  usageRules: string[];
  tipNote: string;
}

/**
 * 保底机制结果 :: 字段填充供监控, lazy 当前禁用 (永远 false).
 * @keyword-en current-session-guard-result, monitor-only
 */
export interface CurrentSessionGuardResult {
  lazy: boolean;
  didInitTip: boolean;
  didEvidenceHook: boolean;
  didPendingAction: boolean;
  didPendingActionDelivery: boolean;
  reasons: string[];
  declaredInitTip: CurrentSessionInitTip | null;
  inferredInitTip: CurrentSessionInitTip;
  pendingAction: CurrentSessionPendingAction | null;
  successfulHookNames: string[];
}

interface CurrentSessionState {
  fields: Record<string, unknown>;
  initTip: CurrentSessionInitTip | null;
  pendingAction: CurrentSessionPendingAction | null;
  hookCalls: CurrentSessionHookCall[];
  /** init_tip tool 是否本轮已被调过; setInitTip 时置 true, beginTurn 重置 */
  didInitTip: boolean;
  updatedAt: number;
}

/**
 * @title Current Session 临时态服务
 * @description 管理单进程内的会话临时字段 + init_tip 判定 + suggestedChain 推荐 + pendingAction 挂起态.
 *              init_tip 是 top-level tool (不是 hook), tool handler 调 setInitTip + produceInitTip; LLM 自由选择是否按 suggestedChain 走.
 * @keywords-cn 当前会话, 临时字段, 链路推荐, 防偷懒
 * @keywords-en current-session, temp-fields, chain-recommendation, lazy-guard
 */
@Injectable()
export class CurrentSessionService {
  private readonly logger = new Logger(CurrentSessionService.name);
  private readonly states = new Map<string, CurrentSessionState>();

  constructor(
    @InjectRepository(ChatMessageEntity)
    private readonly messageRepo: Repository<ChatMessageEntity>,
    @InjectRepository(ChatSessionEntity)
    private readonly sessionRepo: Repository<ChatSessionEntity>,
    @InjectRepository(ChatSessionMemberEntity)
    private readonly memberRepo: Repository<ChatSessionMemberEntity>,
    @InjectRepository(PrincipalEntity)
    private readonly principalRepo: Repository<PrincipalEntity>,
  ) {}

  /**
   * 开始新一轮 agent 对话, 清掉本轮判定和 hook 记录, 保留临时 fields.
   * @keyword-en begin-current-session-turn
   */
  beginTurn(sessionId: string, principalId: string): void {
    const state = this.ensure(sessionId, principalId);
    state.initTip = null;
    state.hookCalls = [];
    state.didInitTip = false;
    state.updatedAt = Date.now();
    this.evictExpired();
  }

  /**
   * 合并临时 session 字段.
   * @keyword-en set-current-session-fields
   */
  setFields(
    sessionId: string,
    principalId: string,
    fields: Record<string, unknown>,
  ): CurrentSessionSnapshot {
    const state = this.ensure(sessionId, principalId);
    state.fields = { ...state.fields, ...fields };
    state.updatedAt = Date.now();
    return this.snapshot(sessionId, principalId);
  }

  /**
   * 设置当前轮 init_tip 固定判定字段, 同时标记 didInitTip=true.
   *  - init_tip 是 top-level tool, 调用时由 tool handler 直接命中本方法 (不走 hookCalls)
   * @keyword-en set-current-session-init-tip
   */
  setInitTip(
    sessionId: string,
    principalId: string,
    input: CurrentSessionInitTip,
  ): CurrentSessionSnapshot {
    const state = this.ensure(sessionId, principalId);
    state.initTip = {
      needKnowledge: input.needKnowledge,
      needHook: input.needHook,
      ...(input.reason ? { reason: input.reason } : {}),
    };
    state.didInitTip = true;
    state.updatedAt = Date.now();
    return this.snapshot(sessionId, principalId);
  }

  /**
   * 设置当前会话待补参数/待确认的平台动作.
   * @keyword-en set-current-session-pending-action
   */
  setPendingAction(
    sessionId: string,
    principalId: string,
    input: CurrentSessionPendingAction,
  ): CurrentSessionSnapshot {
    const state = this.ensure(sessionId, principalId);
    state.pendingAction = normalizePendingAction(input);
    state.updatedAt = Date.now();
    return this.snapshot(sessionId, principalId);
  }

  /**
   * 清除当前会话挂起的平台动作.
   * @keyword-en clear-current-session-pending-action
   */
  clearPendingAction(
    sessionId: string,
    principalId: string,
  ): CurrentSessionSnapshot {
    const state = this.ensure(sessionId, principalId);
    state.pendingAction = null;
    state.updatedAt = Date.now();
    return this.snapshot(sessionId, principalId);
  }

  /**
   * 记录 call_hook 中的一条调用结果.
   * @keyword-en record-current-session-hook-call
   */
  recordHookCall(
    sessionId: string,
    principalId: string | undefined,
    hookName: string,
    ok: boolean,
  ): void {
    const pid = principalId?.trim();
    if (!sessionId || !pid) return;
    const state = this.ensure(sessionId, pid);
    state.hookCalls.push({ hookName, ok, ts: Date.now() });
    if (
      ok &&
      state.pendingAction &&
      isEvidenceHook(hookName) &&
      (!state.pendingAction.hookName ||
        isSameHookName(state.pendingAction.hookName, hookName))
    ) {
      state.pendingAction = null;
    }
    if (state.hookCalls.length > MAX_HOOK_CALLS_PER_TURN) {
      state.hookCalls.shift();
    }
    state.updatedAt = Date.now();
  }

  /**
   * 读取当前临时态快照.
   * @keyword-en get-current-session-snapshot
   */
  snapshot(sessionId: string, principalId: string): CurrentSessionSnapshot {
    const state = this.ensure(sessionId, principalId);
    state.updatedAt = Date.now();
    return {
      sessionId,
      principalId,
      fields: { ...state.fields },
      initTip: state.initTip ? { ...state.initTip } : null,
      pendingAction: clonePendingAction(state.pendingAction),
      hookCalls: [...state.hookCalls],
    };
  }

  /**
   * 从本轮消息结构推导最低工具要求, 用作 JS 兜底判定 (init_tip 缺席时使用).
   * @keyword-en infer-init-tip-from-messages
   */
  inferInitTipFromMessages(messages: ChatMessage[]): CurrentSessionInitTip {
    const content = findLastUserContent(messages);
    const envelope = parseGuidanceEnvelope(content);
    if (envelope) {
      const taskType = readStringPath(envelope, ['task', 'type']);
      const domain = readStringPath(envelope, ['task', 'domain']);
      const needHook = [
        'capability_answer',
        'platform_read',
        'platform_write',
        'previous_result_action',
      ].includes(taskType ?? '');
      const needKnowledge =
        taskType === 'capability_answer' ||
        domain === 'knowledge' ||
        domain === 'hook';
      return {
        needKnowledge,
        needHook,
        reason: `js:${taskType ?? 'unknown'}`,
      };
    }
    return inferInitTipFromText(content);
  }

  /**
   * 获取当前会话完整上下文 :: 双方主体 + peer IP + 会话元数据 + 服务器时间.
   *  - peer 取法 :: 私聊 = 另一成员; 群聊 = 最近一条非 me / 非 system 消息的 sender
   *  - peer.ip :: 来自最近一条 peer 消息 metadata.senderIp (HTTP user 入口时写入)
   *  - 不读 invocationContext, 仅靠 sessionId + myPrincipalId 完整自包含
   * @keyword-en get-current-session-context-snapshot
   */
  async getContextSnapshot(
    sessionId: string,
    myPrincipalId: string,
  ): Promise<CurrentSessionContextSnapshot> {
    const session = await this.sessionRepo.findOne({
      where: [
        { id: sessionId, isDelete: false },
        { sessionId, isDelete: false },
      ],
    });
    if (!session) {
      throw new Error(`session-not-found: ${sessionId}`);
    }
    // chat_session_members.sessionId 实际存的是 ChatSessionEntity.id (PK, 36 长 UUID),
    // 不是 ChatSessionEntity.sessionId (业务 key). addMemberInternal 全部传 session.id.
    // 这里查 member / message 也必须用 session.id, 否则 memberCount=0 / peer=null.
    const sessionPk = session.id;
    const sessionBusinessKey = session.sessionId;

    const members = await this.memberRepo.find({
      where: { sessionId: sessionPk, isDelete: false },
    });

    const memberPrincipalIds = members.map((m) => m.principalId);
    const principals =
      memberPrincipalIds.length > 0
        ? await this.principalRepo.find({
            where: { id: In(memberPrincipalIds), isDelete: false },
          })
        : [];
    const principalMap = new Map(principals.map((p) => [p.id, p]));

    const mePrincipal = principalMap.get(myPrincipalId);
    const me: CurrentSessionContextPrincipal = {
      principalId: myPrincipalId,
      principalType: mePrincipal?.principalType ?? 'unknown',
      displayName: mePrincipal?.displayName ?? '',
      tenantId: mePrincipal?.tenantId ?? null,
    };

    let peerPrincipalId: string | null = null;
    if (session.type === ChatSessionType.Private) {
      const other = members.find((m) => m.principalId !== myPrincipalId);
      peerPrincipalId = other?.principalId ?? null;
    } else {
      const recentMsg = await this.messageRepo
        .createQueryBuilder('m')
        .where('m.session_id = :sid', { sid: sessionBusinessKey })
        .andWhere('m.sender_id IS NOT NULL')
        .andWhere('m.sender_id != :me', { me: myPrincipalId })
        .andWhere('m.message_type != :sys', { sys: ChatMessageType.System })
        .andWhere('m.is_delete = false')
        .orderBy('m.id', 'DESC')
        .limit(1)
        .getOne();
      peerPrincipalId = recentMsg?.senderId ?? null;
    }

    let peer: CurrentSessionContextPeer | null = null;
    if (peerPrincipalId) {
      let peerPrincipal = principalMap.get(peerPrincipalId);
      if (!peerPrincipal) {
        peerPrincipal =
          (await this.principalRepo.findOne({
            where: { id: peerPrincipalId, isDelete: false },
          })) ?? undefined;
      }
      const lastPeerMsg = await this.messageRepo
        .createQueryBuilder('m')
        .where('m.session_id = :sid', { sid: sessionBusinessKey })
        .andWhere('m.sender_id = :pid', { pid: peerPrincipalId })
        .andWhere('m.is_delete = false')
        .orderBy('m.id', 'DESC')
        .limit(1)
        .getOne();
      const ipFromMeta =
        lastPeerMsg?.metadata &&
        typeof lastPeerMsg.metadata.senderIp === 'string'
          ? lastPeerMsg.metadata.senderIp
          : null;
      peer = {
        principalId: peerPrincipalId,
        principalType: peerPrincipal?.principalType ?? 'unknown',
        displayName: peerPrincipal?.displayName ?? '',
        tenantId: peerPrincipal?.tenantId ?? null,
        ip: ipFromMeta,
        lastMessageId: lastPeerMsg?.id ?? null,
        lastMessageAt: lastPeerMsg?.createdAt
          ? new Date(lastPeerMsg.createdAt).toISOString()
          : null,
      };
    }

    const sessionInfo: CurrentSessionContextSession = {
      sessionId: sessionBusinessKey,
      type: session.type,
      name: session.name,
      creatorId: session.creatorId,
      memberCount: members.length,
      members: members.map((m) => {
        const p = principalMap.get(m.principalId);
        return {
          principalId: m.principalId,
          displayName: p?.displayName ?? '',
          principalType: p?.principalType ?? 'unknown',
        };
      }),
    };

    const now = new Date();
    const time: CurrentSessionContextTime = {
      iso: now.toISOString(),
      epochMs: now.getTime(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      weekday: now.toLocaleDateString('en-US', { weekday: 'long' }),
    };

    return { me, peer, session: sessionInfo, time };
  }

  /**
   * 生成 init_tip server-side 推荐 :: 返三大标准发现链路 + 一句话本轮总览.
   *  - discoveryChains 始终返回完整三条 (callLog / knowledge / hook), LLM 找不到数据时按链路自底向上发现
   *  - tipNote 按 declared 强调本轮该走哪条 (纯聊天告诉 LLM 不必走链路)
   *  - 同步, 不读 DB
   * @keyword-en produce-init-tip-suggestions, discovery-chains
   */
  produceInitTip(
    declared: CurrentSessionInitTip,
  ): CurrentSessionInitTipSuggestions {
    return {
      directHooks: buildDirectHooks(),
      discoveryChains: buildDiscoveryChains(),
      usageRules: buildUsageRules(),
      tipNote: buildTipNote(declared),
    };
  }

  /**
   * 保底机制 :: 当前**全量禁用** (lazy 永远 false), 仅保留字段填充供监控/调试.
   *  - 字段保留 :: didInitTip 直接读 state.didInitTip (init_tip 是 tool 不走 hookCalls)
   *  - didEvidenceHook 仍基于 hookCalls 判定 (call_hook 走的业务 hook 算 evidence)
   * @keyword-en evaluate-current-session-tool-guard, lazy-disabled, monitor-only
   */
  evaluateToolGuard(
    sessionId: string,
    principalId: string,
    inferred: CurrentSessionInitTip,
  ): CurrentSessionGuardResult {
    const state = this.ensure(sessionId, principalId);
    const declared = state.initTip;
    const successfulHookNames = state.hookCalls
      .filter((it) => it.ok)
      .map((it) => it.hookName);
    const didInitTip = state.didInitTip;
    const didEvidenceHook = successfulHookNames.some(isEvidenceHook);
    const pendingAction = clonePendingAction(state.pendingAction);
    const didPendingAction =
      isPendingActionGuardExit(pendingAction) &&
      successfulHookNames.includes(
        'saas.app.conversation.currentSession.setPendingAction',
      );
    const didPendingActionDelivery =
      didPendingAction &&
      successfulHookNames.includes('saas.app.conversation.sendMsg');

    return {
      lazy: false,
      didInitTip,
      didEvidenceHook,
      didPendingAction,
      didPendingActionDelivery,
      reasons: [],
      declaredInitTip: declared ? { ...declared } : null,
      inferredInitTip: { ...inferred },
      pendingAction,
      successfulHookNames,
    };
  }

  private ensure(sessionId: string, principalId: string): CurrentSessionState {
    const key = stateKey(sessionId, principalId);
    let state = this.states.get(key);
    if (!state) {
      state = {
        fields: {},
        initTip: null,
        pendingAction: null,
        hookCalls: [],
        didInitTip: false,
        updatedAt: Date.now(),
      };
      this.states.set(key, state);
    }
    return state;
  }

  private evictExpired(): void {
    const cutoff = Date.now() - CURRENT_SESSION_TTL_MS;
    for (const [key, state] of this.states) {
      if (state.updatedAt < cutoff) this.states.delete(key);
    }
  }
}

/**
 * 归一化 pending action, 避免 LLM 写入过大的临时字段.
 * @keyword-en normalize-pending-action
 */
function normalizePendingAction(
  input: CurrentSessionPendingAction,
): CurrentSessionPendingAction {
  const missingFields = Array.from(
    new Set(
      input.missingFields
        .map((it) => it.trim())
        .filter(Boolean)
        .slice(0, 20),
    ),
  );
  return {
    stage: input.stage,
    missingFields,
    collectedFields: input.collectedFields ?? {},
    ...(input.hookName?.trim() ? { hookName: input.hookName.trim() } : {}),
    ...(input.domain?.trim() ? { domain: input.domain.trim() } : {}),
    ...(input.action?.trim() ? { action: input.action.trim() } : {}),
    ...(input.question?.trim()
      ? { question: truncateText(input.question.trim(), 500) }
      : {}),
    ...(input.reason?.trim()
      ? { reason: truncateText(input.reason.trim(), 500) }
      : {}),
  };
}

/**
 * 克隆 pending action 快照.
 * @keyword-en clone-pending-action
 */
function clonePendingAction(
  input: CurrentSessionPendingAction | null,
): CurrentSessionPendingAction | null {
  if (!input) return null;
  return {
    ...input,
    missingFields: [...input.missingFields],
    collectedFields: { ...input.collectedFields },
  };
}

/**
 * 判断 pending action 是否可作为本轮合法非执行出口.
 * @keyword-en pending-action-guard-exit
 */
function isPendingActionGuardExit(
  input: CurrentSessionPendingAction | null,
): boolean {
  if (!input) return false;
  if (input.stage === 'missing_args') {
    return input.missingFields.length > 0 || Boolean(input.question?.trim());
  }
  if (input.stage === 'not_found') {
    return Boolean(
      input.reason?.trim() ||
      input.question?.trim() ||
      input.hookName?.trim() ||
      input.domain?.trim() ||
      input.action?.trim(),
    );
  }
  return false;
}

/**
 * 判断 pendingAction 记录的 hookName 是否匹配真实调用名.
 * @keyword-en match-pending-action-hook-name
 */
function isSameHookName(expected: string, actual: string): boolean {
  const left = expected.trim();
  const right = actual.trim();
  if (!left || !right) return false;
  return left === right || right.endsWith(`.${left}`);
}

/**
 * 截断临时文本, 避免 currentSession 状态被大内容污染.
 * @keyword-en truncate-current-session-text
 */
function truncateText(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

/**
 * 构造 currentSession 临时态 key.
 * @keyword-en current-session-state-key
 */
function stateKey(sessionId: string, principalId: string): string {
  return `${sessionId}:${principalId}`;
}

/**
 * 查找最后一条 user message 的内容.
 * @keyword-en find-last-user-content
 */
function findLastUserContent(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg?.role === 'user') return msg.content;
  }
  return '';
}

/**
 * 尝试解析 IM guidance envelope (历史 v3 envelope 兼容; 新链路 user 直发原话, 这里多数命中 null).
 * @keyword-en parse-guidance-envelope
 */
function parseGuidanceEnvelope(
  content: string,
): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 读取 object path 上的 string.
 * @keyword-en read-string-path
 */
function readStringPath(
  obj: Record<string, unknown>,
  path: string[],
): string | null {
  let cur: unknown = obj;
  for (const seg of path) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return null;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return typeof cur === 'string' ? cur : null;
}

/**
 * 从普通文本粗略推导工具需求 (init_tip 兜底).
 * @keyword-en infer-init-tip-from-text
 */
function inferInitTipFromText(text: string): CurrentSessionInitTip {
  const normalized = text.trim().toLowerCase();
  const needKnowledge =
    /(能力|能干嘛|能做什么|会什么|支持什么|知识|手册|权限|角色|hook|runner|solution|capability|manual|knowledge)/.test(
      normalized,
    );
  const needHook =
    /(查|查询|搜索|列出|创建|新建|修改|更新|删除|上传|下载|保存|权限|成员|角色|组织|文件|资源|应用|待办|runner|solution|hook|previous|last|刚刚|刚才|上一条)/.test(
      normalized,
    );
  return { needKnowledge, needHook, reason: 'js:text' };
}

/**
 * 判断 hook 是否满足证据/动作调用要求 :: 排除 currentSession.* / sendMsg (init_tip 不会出现在 hookCalls, 因为它是 tool 不是 hook).
 * @keyword-en is-evidence-hook
 */
function isEvidenceHook(hookName: string): boolean {
  if (hookName.startsWith('saas.app.conversation.currentSession.'))
    return false;
  if (hookName === 'saas.app.conversation.sendMsg') return false;
  return true;
}

/**
 * 构造三大标准发现链路 (callLog / knowledge / hook); 静态内容, 总是返回完整三条.
 *  - 上下文找不到数据时, LLM 按这些链路自底向上发现 (tag → search → detail)
 *  - 每条链路是 "标准操作流程" (SOP), 步骤之间有明确依赖顺序
 * @keyword-en build-discovery-chains, tag-search-detail
 */
function buildDiscoveryChains(): {
  callLog: string[];
  knowledge: string[];
  hook: string[];
  history: string[];
} {
  return {
    callLog: [
      '① 拿全景 :: call_hook saas.app.conversation.callHistory.query [{}] → 返最近 50 条成功 hook 调用的轻量列表 ({id, hookName, title, ts})',
      '② 匹配命中 :: 在 title / hookName 里找跟本轮意图相关项; 也可加 search 关键词收窄: [{ search: "<keyword>" }]',
      '③ 取详情复用 :: call_hook saas.app.conversation.callHistory.query [{ id:"<matched-id>", includeDetail:true }] → 拿完整 payload + result, 复用 payload 形状直接调业务 hook',
      '④ 收尾 :: call_hook saas.app.conversation.sendMsg 把结果反馈给用户; turn 完成',
    ],
    knowledge: [
      '① 拿 tag 全景 :: call_hook saas.app.knowledge.getTag [{}] → 返知识库 tag 频次榜 (上限 400, 包含所有 local + tenant 书的 tag)',
      '② 按 tag 搜书 :: call_hook saas.app.knowledge.search [{ tags:["<挑出来的 tag>"] }] → 命中的书列表 (前 100, 任一 tag 命中即返); ⚠ tags 必须来自 ① 的真实结果, 不要自创',
      '③ 拿目录 :: call_hook saas.app.knowledge.getToc [{ bookIds:["<bookId>"] }] → 目录章节列表',
      '④ 读章节 :: call_hook saas.app.knowledge.getChapter [{ bookIds:["<bookId>"], chapterIds:["<chapterId>"] }] → 完整章节内容; LM 必读章节会自动随返',
      '⑤ 收尾 :: 审阅完即 call_hook saas.app.conversation.sendMsg 把权威说法回复给用户; turn 完成',
    ],
    hook: [
      '⚠ target 选择 :: 默认 target="saas" 走 SaaS HookBus. 想用 runner 端能力 (本地文件 / mongo / terminal / runner app 业务) → **必须先调 call_hook saas.app.runner.list [{status:"mounted"}]** 拿真实 runnerId, 之后 tool/call_hook 的 target="runner" 参数都必须带 runnerId. 不知道 runnerId 时盲填会 softError "runnerId-required". **强烈建议同时读 Runner 手册** (bookId="local_runner_hook_skill"): LM必读章节含调用约定 + errorMsg 字典 (自动加载); 用 unit-core / identity / solution / 数据触点时按需读对应子章节 (local_runner_hook_skill_unitcore / _identity / _solution / _data_touchpoint), 不读容易在 UUID / 4 段名 / array payload / denyLlm 上踩坑.',
      '① 拿 hook tag 全景 :: tool get_hook_tag [{target}] → tag 频次榜 (上限 400). target="runner" 时 runnerId 必填',
      '② 按 tag 缩范围 :: tool search_hook [{ target, runnerId?, tags:["<挑出来的 tag>"] }] → 命中的 hook 列表; ⚠ tags 必须来自 ① 的真实结果, 不要自创',
      '③ 拿 description + schema :: tool get_hook_info [{ target, runnerId?, hookNames:["<挑出来的 hook>"] }] → 描述 + JSON Schema, 写 payload 必看',
      '④ 调用业务 hook :: call_hook <fullHookName> [{...按 schema 写...}], saas.* 前缀走 saas / runner.* 走 runner (runnerId 必填) → 执行业务',
      '⑤ 收尾 :: call_hook saas.app.conversation.sendMsg 把结果反馈给用户; turn 完成',
    ],
    history: [
      '⚠ 适用场景 :: 用户说"我们之前聊过...","上次提到的...","昨天那件事","我之前的方案"等**需要回看本会话历史**的问题. 不要凭记忆瞎答, 也不要从近 18 条窗口外硬猜.',
      '⚠ sessionId 必传 :: 三个 hook 都要求 payload 包含 sessionId. 从 directHooks.currentSession.context 拿到 session.id 后填入 (或复用 ctx.extras.sessionId — 但 hook 参数必须显式写出来, 不是自动注入).',
      '① 拿历史关键词 :: call_hook saas.app.conversation.smartTags [{ sessionId:"<当前 sessionId>" }] → 返本会话所有 smart 段的 keyword 全景 (按时间段聚合的会话摘要 tag, 频次倒序)',
      '② 按关键词搜段 :: call_hook saas.app.conversation.smartSearch [{ sessionId:"<当前 sessionId>", keywords:["<挑出来的 tag>"], limit?:50 }] → 命中的 smart 段 summary 列表 (含 smartId + 摘要 + 时间区间); ⚠ keywords 必须来自 ① 的真实 tag, 不要自创',
      '③ 展开原始消息 :: call_hook saas.app.conversation.smartMessages [{ sessionId:"<当前 sessionId>", smartIds:["<匹配的 smartId>"] }] → 拿对应时间段内的完整原始消息 (含 attachments resourceId 等), 不再是摘要; smartIds 上限 20.',
      '④ 收尾 :: 基于展开的原始消息组织回答, call_hook saas.app.conversation.sendMsg 发给用户; turn 完成',
      '⚠ 不要跳过 ① 直接 smartSearch — 自创 keyword 命中率低, 浪费一次空查',
    ],
  };
}

/**
 * 构造已知常用 hook 的快捷入口; 不需要发现链路, LLM 直接 call_hook 即可.
 *  - 这些 hook 名固定 + 高频, 但藏在 current-session / conversation 命名空间, LLM 走 hook 链路按 identity/user tag 搜不到
 *  - 列出来让 LLM 一开始就知道, 避免无效 search
 * @keyword-en build-direct-hooks, known-shortcut-hooks
 */
function buildDirectHooks(): string[] {
  return [
    'call_hook saas.app.conversation.currentSession.context [{}] :: **想知道"我是谁 / 对方是谁 / 对方 IP / 当前时间"必走这个**. 一次返 { me, peer, session, time } — me/peer 含 principalId/principalType/displayName/tenantId; peer 还含 ip + lastMessageId; session 含 type/name/members; time 含 iso/timezone/weekday. 不要 search_hook 找 identity/user, 直接调.',
    'call_hook saas.app.conversation.currentSession.get [{}] :: 拿本轮临时态快照 (fields / initTip / pendingAction / hookCalls), 调试 / 检查自己本轮状态时用',
    'call_hook saas.app.conversation.currentSession.setPendingAction [{stage, hookName?, missingFields?, question?, reason?}] :: 业务 hook 缺必填参数 → stage="missing_args" + missingFields + question; 平台无对应能力 → stage="not_found" + reason. 之后必发 sendMsg 把 question/reason 交给用户, 这是合法非执行出口.',
    'call_hook saas.app.conversation.callHistory.query [{}] / [{id, includeDetail:true}] :: 见 discoveryChains.callLog, 复用最近 50 条成功 hook 调用',
    'call_hook saas.app.runner.list [{status:"mounted"}] :: **想用 runner 端能力 (search_hook/get_hook_tag/get_hook_info/call_hook target=runner) 必须先调这个**拿真实 runnerId; status="mounted" 过滤当前在线可派发的 runner. **配套读 Runner 手册** (bookId="local_runner_hook_skill"): LM必读自动加载; 按场景读子章节 — Unit Core (mongo/terminal/file/ast) 走 _unitcore; permission-denied / 自建 principal / 数据权限走 _identity; solution 装载/查询走 _solution; 长期监控/触点走 _data_touchpoint.',
  ];
}

/**
 * 构造 init_tip 的 cross-cutting 使用规则; 静态 4 条, 跨所有链路共用.
 *  - commit early :: 1-2 个候选立即 call, 不要反复 search
 *  - no loops :: 整 turn search+info ≤ 3 次, 超了强行 commit
 *  - no skip :: 按 ①→②→③→④→⑤ 顺序, 不跳步
 *  - must sendMsg :: 业务 / 知识完成后必发 sendMsg, 否则消息丢失
 * @keyword-en build-usage-rules, commit-early, no-loops, no-skip, must-send-msg
 */
function buildUsageRules(): string[] {
  return [
    '⚠ commit early :: search_hook / get_hook_info 拿到 1-2 个 plausible 候选立即 call_hook commit, 不要反复 search. 候选不准也优先 call 一次拿 errorMsg, 比再 search 一轮快得多.',
    '⚠ no loops :: 整 turn search_hook + get_hook_info 合计 ≤ 3 次. 超过这个数说明卡死了, 必须 commit 现有最佳候选, 不要继续发现.',
    '⚠ no skip :: 每条链路按 ①→②→③→④→⑤ 顺序走, 不跳步. 例: 没 getTag 就 search 会用错 tag; 没 get_hook_info 就 call_hook 会写错 payload.',
    '⚠ must sendMsg :: 业务 hook 完成后 / 知识章节读完后, **必须** call_hook saas.app.conversation.sendMsg 把结果反馈给用户. 直接返回 final prose 不会送达用户 — 等于消息丢失.',
  ];
}

/**
 * 构造 tipNote 一句话本轮总览; 按 declared 强调走哪条链路.
 * @keyword-en build-tip-note
 */
function buildTipNote(declared: CurrentSessionInitTip): string {
  const parts: string[] = [];
  if (declared.needHistory) {
    parts.push(
      'Need to recall past conversation in this session → walk the history chain (smartTags → smartSearch → smartMessages). NEVER answer "what we discussed before" from memory or from the last 18 messages alone.',
    );
  }
  if (declared.needKnowledge && declared.needHook) {
    parts.push(
      'BOTH knowledge and business hooks needed. Follow the three discovery chains (callLog → knowledge → hook) bottom-up when context is insufficient.',
    );
  } else if (declared.needKnowledge) {
    parts.push(
      'Authoritative knowledge needed. Walk the knowledge chain: getTag → search → getToc → getChapter.',
    );
  } else if (declared.needHook) {
    parts.push(
      'Business hook needed. First reuse via callLog chain (query[{}] → match → includeDetail); if no match, walk the hook chain (get_hook_tag → search_hook → get_hook_info → call_hook).',
    );
  }
  if (parts.length === 0) {
    return 'Pure chat this turn — no discovery needed. Call call_hook saas.app.conversation.sendMsg once and finish.';
  }
  parts.push('Read usageRules before walking any chain.');
  return parts.join(' ');
}
