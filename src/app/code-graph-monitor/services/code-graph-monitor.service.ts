// AGENT-MONITOR-TEMP :: 临时调试监听, 后期整体删除 (grep AGENT-MONITOR-TEMP)
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  publishCodeGraphProgress,
  setCodeGraphProgressSink,
  type CodeGraphProgressMessage,
} from '@/agents/code-agent/monitor/code-graph-progress.sink';

type ProgressListener = (msg: CodeGraphProgressMessage) => void;

/**
 * @title Code Graph 监听服务
 * @description code-agent 运行进度的进程内枢纽: 注册全局进度 sink, 把每条节点日志 / LLM 调用事件按 sessionId
 *   存进定长环形缓冲 (供晚到的监听页 backfill 回放), 并广播给已订阅的 gateway 监听器 (实时推送)。缓冲有会话数
 *   与单会话条数双上限, 防内存泄漏。单实例内存态; 跨实例 HA 回放留后续 (可换 Redis)。
 * @keyword-cn 监听服务, 环形缓冲
 * @keyword-en monitor-service, ring-buffer
 */
@Injectable()
export class CodeGraphMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly buffers = new Map<string, CodeGraphProgressMessage[]>();
  private readonly listeners = new Set<ProgressListener>();
  private readonly maxPerSession = 800;
  private readonly maxSessions = 200;

  /**
   * 启动时把自己注册成全局进度 sink; code graph 的 graphLog / aiAdapter 插桩产生的事件都会流进 ingest。
   * @keyword-cn 注册sink, 监听服务
   * @keyword-en register-sink, monitor-service
   */
  onModuleInit(): void {
    setCodeGraphProgressSink((msg) => this.ingest(msg));
  }

  /**
   * 卸载时摘除 sink, 避免悬挂引用。
   * @keyword-cn 摘除sink, 监听服务
   * @keyword-en detach-sink, monitor-service
   */
  onModuleDestroy(): void {
    setCodeGraphProgressSink(null);
  }

  /**
   * 收一条进度: 追加进该会话环形缓冲 (超上限裁旧 + 会话数超限逐出最早会话), 再广播给所有监听器。
   * @keyword-cn 收进度, 环形缓冲
   * @keyword-en ingest-progress, ring-buffer
   */
  private ingest(msg: CodeGraphProgressMessage): void {
    let buffer = this.buffers.get(msg.sessionId);
    if (!buffer) {
      if (this.buffers.size >= this.maxSessions) {
        const oldest = this.buffers.keys().next().value;
        if (oldest !== undefined) this.buffers.delete(oldest);
      }
      buffer = [];
      this.buffers.set(msg.sessionId, buffer);
    }
    buffer.push(msg);
    if (buffer.length > this.maxPerSession) {
      buffer.splice(0, buffer.length - this.maxPerSession);
    }
    for (const listener of this.listeners) {
      try {
        listener(msg);
      } catch {
        // 单个监听器故障不影响其它推送
      }
    }
  }

  /**
   * 读某会话已缓冲的全部进度 (供监听页连接时 backfill 回放已发生的节点/LLM 事件)。
   * @keyword-cn 回放缓冲, 监听服务
   * @keyword-en backfill-buffer, monitor-service
   */
  getBackfill(sessionId: string): CodeGraphProgressMessage[] {
    return this.buffers.get(sessionId) ?? [];
  }

  /**
   * 订阅实时进度; 返回取消订阅函数。gateway 用它把事件广播到对应 session 房间。
   * @keyword-cn 订阅进度, 监听服务
   * @keyword-en subscribe-progress, monitor-service
   */
  onProgress(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 手动注入一条进度 (测试 / 外部来源用); 正常由全局 sink 自动喂入。
   * @keyword-cn 注入进度, 监听服务
   * @keyword-en emit-progress, monitor-service
   */
  emit(msg: CodeGraphProgressMessage): void {
    publishCodeGraphProgress(msg);
  }
}
