import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  HookMonitorRecord,
  HookMonitorQuery,
  HookMonitorStatsItem,
} from '../types/hook-monitor.types';

/**
 * @title HookMonitor 存储
 * @description 无数据库的内存环形缓冲存储与统计。
 * @keywords-cn Hook监控存储, 内存缓冲, 统计
 * @keywords-en hook-monitor-store, in-memory-buffer, stats
 */
@Injectable()
export class HookMonitorStoreService {
  private readonly max = 1000;
  private buffer: HookMonitorRecord[] = [];

  add(record: Omit<HookMonitorRecord, 'id'>): HookMonitorRecord {
    const id = randomUUID();
    const full: HookMonitorRecord = { ...record, id };
    if (this.buffer.length >= this.max) this.buffer.shift();
    this.buffer.push(full);
    return full;
  }

  list(query?: HookMonitorQuery): HookMonitorRecord[] {
    const name = query?.name;
    const status = query?.status;
    const limit = Math.max(1, Math.min(query?.limit ?? 200, this.max));
    const filtered = this.buffer.filter((r) => {
      if (name && r.name !== name) return false;
      if (status && r.status !== status) return false;
      return true;
    });
    return filtered.slice(-limit).reverse();
  }

  get(id: string): HookMonitorRecord | undefined {
    return this.buffer.find((r) => r.id === id);
  }

  stats(name?: string): HookMonitorStatsItem[] {
    const groups = new Map<string, HookMonitorRecord[]>();
    for (const r of this.buffer) {
      const key = r.name;
      if (name && key !== name) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    const items: HookMonitorStatsItem[] = [];
    for (const [k, arr] of groups.entries()) {
      const durations = arr.map((r) => r.durationMs).sort((a, b) => a - b);
      const avg =
        durations.reduce((s, v) => s + v, 0) / Math.max(1, durations.length);
      const p95 =
        durations[Math.max(0, Math.floor(durations.length * 0.95) - 1)] ?? 0;
      items.push({
        name: k,
        count: arr.length,
        avgMs: Math.round(avg),
        p95Ms: Math.round(p95),
        success: arr.filter((r) => r.status === 'success').length,
        error: arr.filter((r) => r.status === 'error').length,
        skipped: arr.filter((r) => r.status === 'skipped').length,
      });
    }
    return items.sort((a, b) => b.count - a.count);
  }
}
