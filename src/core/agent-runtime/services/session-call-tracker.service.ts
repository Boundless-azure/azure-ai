import { Injectable, Logger } from '@nestjs/common';

/**
 * @title 会话级 call_hook 调用追踪 (单进程内存)
 * @description 按 sessionId 维度记录主对话 LLM 的所有 call_hook 调用 (含 result/errorMsg), 用于硬匹配触发独立的 sessionData 沉淀 LLM. records 上限 200 条 LRU.
 *              触发条件 (任一命中即触发):
 *                ① 调过 saas.app.knowledge.getChapter (读了知识)
 *                ② 累计 records ≥ 50 (轮次过多)
 *                ③ get_hook_info 调用 ≥ 5 次 (LLM 在反复探索)
 *              触发后 resetTriggers 清零三个累计字段, records 数组保留供 LLM 决策时使用.
 * @keywords-cn 调用追踪, 硬匹配, 沉淀触发, 内存map, 知识读取检测
 * @keywords-en call-tracker, hard-match, save-trigger, in-memory, knowledge-read-detection
 */

const MAX_RECORDS = 200;
const TRIGGER_TOTAL = 50;
const TRIGGER_GET_HOOK_INFO = 5;
const KNOWLEDGE_GET_CHAPTER_HOOK = 'saas.app.knowledge.getChapter';

/** 单次 call_hook 的完整记录 (供 sessionData LLM 决策) */
export interface CallRecord {
  hookName: string;
  target: 'saas' | 'runner';
  payload: unknown;
  result: unknown | null;
  errorMsg: string[];
  ts: number;
}

interface SessionTracker {
  /** 最近 MAX_RECORDS 条 call_hook 记录, FIFO LRU */
  records: CallRecord[];
  /** 是否调过 getChapter 拿到章节 (errorMsg 为空才算) */
  hasReadKnowledge: boolean;
  /** 累计 get_hook_info 调用次数 */
  getHookInfoCount: number;
  /** 累计 call_hook 调用次数 (跟 records 长度同步, 但 records 是 LRU 限长, 这个累计) */
  totalCount: number;
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
    t.totalCount += 1;
    if (rec.hookName === KNOWLEDGE_GET_CHAPTER_HOOK && rec.errorMsg.length === 0) {
      t.hasReadKnowledge = true;
      this.logger.log(
        `[tracker] session=${sessionId} hasReadKnowledge=true (getChapter ok)`,
      );
    }
  }

  /**
   * 记一次 get_hook_info 调用 (独立工具不走 call_hook, 单独计数)
   * @keyword-en record-get-hook-info
   */
  recordGetHookInfo(sessionId: string): void {
    if (!sessionId) return;
    const t = this.ensure(sessionId);
    t.getHookInfoCount += 1;
  }

  /**
   * 硬匹配检查 :: 任一条件命中即返回 true
   * @keyword-en should-trigger-save
   */
  shouldTriggerSave(sessionId: string): boolean {
    const t = this.map.get(sessionId);
    if (!t) return false;
    return (
      t.hasReadKnowledge ||
      t.totalCount >= TRIGGER_TOTAL ||
      t.getHookInfoCount >= TRIGGER_GET_HOOK_INFO
    );
  }

  /**
   * 触发后 reset 三个累计字段 (records 不动, 留给 LLM 决策)
   * @keyword-en reset-triggers
   */
  resetTriggers(sessionId: string): void {
    const t = this.map.get(sessionId);
    if (!t) return;
    t.hasReadKnowledge = false;
    t.totalCount = 0;
    t.getHookInfoCount = 0;
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
        getHookInfoCount: 0,
        totalCount: 0,
      };
      this.map.set(sessionId, t);
    }
    return t;
  }
}
