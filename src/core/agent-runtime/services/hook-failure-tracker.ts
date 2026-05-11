/**
 * @title LLM hook 调用失败追踪 (轻量内存计数器)
 * @description 在一次 LLM 会话内追踪同一 hook 的连续失败次数. 累计 ≥ 3 次时 LlmHookTool 在 reply.errorMsg 末尾追加引导, 提示 LLM 下次调用传 debug:true 启用 OTel trace 拿 handler 内部日志做根因分析. 成功调用清零.
 *              内存级 LRU + TTL, 上限 1000 entry / TTL 5 分钟无活动. 单进程内有效, 跨实例不共享 (即便共享意义不大, 一次会话通常落同一进程).
 *              典型治愈场景: LLM 把 id="1 " (尾空格 / 错误格式) 反复试 ─► 拿不到 ─► 失败 3 次 ─► 收到引导 ─► 开 debug 拿 trace ─► 看到 service 层 warn 解释 ─► 改用 saas.app.identity.roleList 拿真实 id.
 * @keywords-cn hook失败追踪, 重试引导, debug提示, 自我诊断, LRU, TTL
 * @keywords-en hook-failure-tracker, retry-hint, debug-hint, self-diagnosis, lru, ttl
 */

const TTL_MS = 5 * 60 * 1_000;
const MAX_ENTRIES = 1_000;
/** 累计失败达到此阈值时, errorMsg 追加引导 */
export const FAILURE_HINT_THRESHOLD = 3;

interface FailureRecord {
  count: number;
  lastAt: number;
}

const map = new Map<string, FailureRecord>();

/**
 * 记录一次失败, 返回累计次数 (含本次)
 *  - 距上次活动超 TTL → 视为新会话, 计数从 1 开始
 *  - 超 LRU 上限时驱逐最旧 entry
 * @keyword-en record-hook-failure
 */
export function recordHookFailure(key: string): number {
  pruneIfNeeded();
  const now = Date.now();
  const existing = map.get(key);
  if (!existing || now - existing.lastAt > TTL_MS) {
    map.set(key, { count: 1, lastAt: now });
    return 1;
  }
  // delete + set 重新插入末尾, 维持 LRU 顺序 (Map 保证插入顺序)
  map.delete(key);
  const next: FailureRecord = { count: existing.count + 1, lastAt: now };
  map.set(key, next);
  return next.count;
}

/**
 * 记录一次成功, 清零该 key 的失败计数
 * @keyword-en record-hook-success
 */
export function recordHookSuccess(key: string): void {
  map.delete(key);
}

/**
 * 构造 failure tracker key: 优先 sessionId, 退化到 principalId, 再退化 'anon'
 *  - 不入 payload, 反复试不同 payload 也算累积失败 (符合"反复试 N 次"语义)
 * @keyword-en build-failure-key
 */
export function buildFailureKey(
  sessionId: string | undefined,
  principalId: string | undefined,
  hookName: string,
): string {
  return `${sessionId ?? principalId ?? 'anon'}:${hookName}`;
}

function pruneIfNeeded(): void {
  if (map.size <= MAX_ENTRIES) return;
  const oldest = map.keys().next();
  if (!oldest.done) map.delete(oldest.value);
}
