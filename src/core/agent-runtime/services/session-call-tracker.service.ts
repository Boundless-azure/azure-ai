import { Injectable, Logger } from '@nestjs/common';

/**
 * @title 会话级 call_hook 调用追踪 (单进程内存)
 * @description 按 sessionId 维度记录主对话 LLM 的所有 call_hook 调用 (含 result/errorMsg), 用于低频硬匹配触发独立的 sessionData 沉淀 LLM. records 上限 200 条 LRU.
 *              低频触发条件 (任一命中 + 冷却时间已过):
 *                ① 调过 saas.app.knowledge.getChapter (读了知识章节)
 *                ② 同一个 hook 曾失败, 后续又成功 (形成明确纠错经验)
 *              不再用 records 数量 / get_hook_info 次数触发, 避免探索多就写入脏记忆.
 *              触发后 resetTriggers 清零事件标记, records 数组保留供 LLM 决策时使用.
 * @keywords-cn 调用追踪, 低频触发, 沉淀触发, 内存map, 知识读取检测, 失败恢复
 * @keywords-en call-tracker, low-frequency-trigger, save-trigger, in-memory, knowledge-read-detection, failure-recovery
 */

const MAX_RECORDS = 200;
const SAVE_TRIGGER_COOLDOWN_MS = 10 * 60 * 1000;
const KNOWLEDGE_GET_CHAPTER_HOOK = 'saas.app.knowledge.getChapter';

/** 单次 call_hook 的完整记录 (供 sessionData LLM 决策) */
export interface CallRecord {
  hookName: string;
  target: 'saas' | 'runner';
  payload: unknown;
  result: unknown;
  errorMsg: string[];
  ts: number;
}

interface SessionTracker {
  /** 最近 MAX_RECORDS 条 call_hook 记录, FIFO LRU */
  records: CallRecord[];
  /** 是否调过 getChapter 拿到章节 (errorMsg 为空才算) */
  hasReadKnowledge: boolean;
  /** 失败过的 hookName 集合; 后续成功时转成 hasRecoveredFailure */
  failedHookNames: Set<string>;
  /** 是否出现过"失败后成功"的明确纠错事件 */
  hasRecoveredFailure: boolean;
  /** 最近一次触发沉淀 LLM 的时间, 用于低频冷却 */
  lastSaveTriggeredAt: number;
}

@Injectable()
export class SessionCallTrackerService {
  private readonly logger = new Logger(SessionCallTrackerService.name);
  private readonly map = new Map<string, SessionTracker>();

  /**
   * 记一次 call_hook 调用
   * @keyword-en record-call-hook
   */
  record(sessionId: string, rec: CallRecord): void {
    if (!sessionId) return;
    const t = this.ensure(sessionId);
    t.records.push(rec);
    if (t.records.length > MAX_RECORDS) {
      t.records.shift();
    }
    const ok = rec.errorMsg.length === 0;
    if (!ok) {
      t.failedHookNames.add(rec.hookName);
      return;
    }

    if (t.failedHookNames.delete(rec.hookName)) {
      t.hasRecoveredFailure = true;
      this.logger.log(
        `[tracker] session=${sessionId} hasRecoveredFailure=true hook=${rec.hookName}`,
      );
    }

    if (rec.hookName === KNOWLEDGE_GET_CHAPTER_HOOK && ok) {
      t.hasReadKnowledge = true;
      this.logger.log(
        `[tracker] session=${sessionId} hasReadKnowledge=true (getChapter ok)`,
      );
    }
  }

  /**
   * 低频硬匹配检查 :: 明确沉淀事件 + 冷却时间已过才返回 true
   * @keyword-en should-trigger-save
   */
  shouldTriggerSave(sessionId: string): boolean {
    const t = this.map.get(sessionId);
    if (!t) return false;
    if (!t.hasReadKnowledge && !t.hasRecoveredFailure) return false;
    const elapsed = Date.now() - t.lastSaveTriggeredAt;
    if (elapsed < SAVE_TRIGGER_COOLDOWN_MS) return false;
    return true;
  }

  /**
   * 触发后 reset 事件标记 (records 不动, 留给 LLM 决策), 并记录冷却时间
   * @keyword-en reset-triggers
   */
  resetTriggers(sessionId: string): void {
    const t = this.map.get(sessionId);
    if (!t) return;
    t.hasReadKnowledge = false;
    t.hasRecoveredFailure = false;
    t.failedHookNames.clear();
    t.lastSaveTriggeredAt = Date.now();
  }

  /**
   * 取该 session 当前 records (供 sessionData LLM 决策)
   * @keyword-en get-records
   */
  getRecords(sessionId: string): CallRecord[] {
    return this.map.get(sessionId)?.records ?? [];
  }

  /**
   * 清掉指定 session 的全部追踪 (会话结束时, 当前未接入清理时机)
   * @keyword-en clear-session
   */
  clear(sessionId: string): void {
    this.map.delete(sessionId);
  }

  private ensure(sessionId: string): SessionTracker {
    let t = this.map.get(sessionId);
    if (!t) {
      t = {
        records: [],
        hasReadKnowledge: false,
        failedHookNames: new Set<string>(),
        hasRecoveredFailure: false,
        lastSaveTriggeredAt: 0,
      };
      this.map.set(sessionId, t);
    }
    return t;
  }
}
