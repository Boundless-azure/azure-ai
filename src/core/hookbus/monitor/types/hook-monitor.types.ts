/**
 * @title HookMonitor 类型定义
 * @description 监控记录与查询参数类型。
 * @keywords-cn Hook监控, 事件记录, 查询参数
 * @keywords-en hook-monitor, event-record, query-params
 */
export interface HookMonitorRecord {
  id: string;
  name: string;
  requestId?: string;
  startTs: number;
  endTs: number;
  durationMs: number;
  status: 'success' | 'error' | 'skipped';
  payload?: unknown;
  resultData?: unknown;
  error?: string;
  originFile?: string;
  originLine?: number;
  originStack?: string[];
  receiverId?: string;
  receiverPluginName?: string;
  receiverPhase?: string;
  receiverTags?: string[];
  processId?: number;
}

export interface HookMonitorQuery {
  name?: string;
  status?: 'success' | 'error' | 'skipped';
  limit?: number;
}

export interface HookMonitorStatsItem {
  name: string;
  count: number;
  avgMs: number;
  p95Ms: number;
  success: number;
  error: number;
  skipped: number;
}
