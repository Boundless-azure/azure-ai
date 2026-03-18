import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { HookMonitorStoreService } from '../cache/hook.monitor.store';
import type {
  HookMonitorQuery,
  HookMonitorRecord,
  HookMonitorStatsItem,
} from '../types/hook-monitor.types';

/**
 * @title HookMonitor 控制器
 * @description 提供 web 可视化的查询 API：事件列表、详情与统计。
 * @keywords-cn Hook监控接口, 事件查询, 性能统计
 * @keywords-en hook-monitor-controller, event-query, performance-stats
 */
@Controller('hook-monitor')
export class HookMonitorController {
  constructor(private readonly store: HookMonitorStoreService) {}

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  index(@Query() q: HookMonitorQuery): string {
    const records = this.store.list(q);
    const stats = this.store.stats(q?.name);
    const html = this.renderIndex(records, stats, q);
    return html;
  }

  @Get('event/:id')
  @Header('Content-Type', 'text/html; charset=utf-8')
  event(@Param('id') id: string): string {
    const rec = this.store.get(id);
    return this.renderDetail(rec);
  }

  @Get('stats')
  @Header('Content-Type', 'text/html; charset=utf-8')
  statsPage(@Query('name') name?: string): string {
    const items = this.store.stats(name);
    return this.renderStats(items, name);
  }

  private escapeHtml(v: unknown): string {
    const s = typeof v === 'string' ? v : JSON.stringify(v, null, 2);
    return s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  private renderIndex(
    records: HookMonitorRecord[],
    stats: HookMonitorStatsItem[],
    q?: HookMonitorQuery,
  ): string {
    const rows = records
      .map((r) => {
        const origin = [r.originFile, r.originLine].filter(Boolean).join(':');
        const recv = [r.receiverPluginName, r.receiverPhase]
          .filter(Boolean)
          .join(' / ');
        return `<tr>
          <td>${new Date(r.startTs).toLocaleTimeString()}</td>
          <td><a href="./event/${r.id}">${this.escapeHtml(r.name)}</a></td>
          <td>${r.status}</td>
          <td>${r.durationMs} ms</td>
          <td>${this.escapeHtml(origin)}</td>
          <td>${this.escapeHtml(recv)}</td>
        </tr>`;
      })
      .join('');

    const statsRows = stats
      .map(
        (s) => `<tr>
          <td><a href="./?name=${encodeURIComponent(s.name)}">${this.escapeHtml(s.name)}</a></td>
          <td>${s.count}</td>
          <td>${s.avgMs} ms</td>
          <td>${s.p95Ms} ms</td>
          <td>${s.success}</td>
          <td>${s.error}</td>
          <td>${s.skipped}</td>
        </tr>`,
      )
      .join('');

    const nameFilter = this.escapeHtml(q?.name ?? '');
    const statusFilter = this.escapeHtml(q?.status ?? '');

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Hook Monitor</title>
  <style>
    body { font-family: ui-sans-serif, system-ui; margin: 20px; }
    table { border-collapse: collapse; width: 100%; margin-top: 12px; }
    th, td { border: 1px solid #ddd; padding: 8px; }
    th { background: #f5f5f5; text-align: left; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .controls input, .controls select { padding: 6px 8px; }
  </style>
</head>
<body>
  <h1>Hook Monitor</h1>
  <div class="controls">
    <form method="get" action="./">
      <label>Hook 名称: <input type="text" name="name" value="${nameFilter}" /></label>
      <label>状态:
        <select name="status">
          <option value="">(全部)</option>
          <option value="success" ${statusFilter === 'success' ? 'selected' : ''}>success</option>
          <option value="error" ${statusFilter === 'error' ? 'selected' : ''}>error</option>
          <option value="skipped" ${statusFilter === 'skipped' ? 'selected' : ''}>skipped</option>
        </select>
      </label>
      <label>条数: <input type="number" name="limit" value="${q?.limit ?? 200}" min="1" max="1000" /></label>
      <button type="submit">筛选</button>
      <a href="./">重置</a>
      <a href="./stats">统计</a>
    </form>
  </div>
  <div class="grid">
    <section>
      <h2>最近事件</h2>
      <table>
        <thead>
          <tr><th>时间</th><th>Hook 名称</th><th>状态</th><th>耗时</th><th>发起位置</th><th>接收信息</th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="6">暂无数据</td></tr>'}</tbody>
      </table>
    </section>
    <section>
      <h2>统计概览</h2>
      <table>
        <thead>
          <tr><th>Hook 名称</th><th>次数</th><th>平均</th><th>P95</th><th>成功</th><th>错误</th><th>跳过</th></tr>
        </thead>
        <tbody>${statsRows || '<tr><td colspan="7">暂无数据</td></tr>'}</tbody>
      </table>
    </section>
  </div>
</body>
</html>`;
  }

  private renderDetail(rec?: HookMonitorRecord): string {
    if (!rec)
      return `<!doctype html><html><body><h1>未找到</h1><p>事件不存在</p><p><a href="../">返回列表</a></p></body></html>`;
    const payload = this.escapeHtml(rec.payload);
    const result = this.escapeHtml(rec.resultData);
    const stack = (rec.originStack ?? [])
      .map((s) => `<li><code>${this.escapeHtml(s)}</code></li>`)
      .join('');
    return `<!doctype html>
<html><head><meta charset="utf-8" /><title>Hook 详情</title>
<style>body{font-family:ui-sans-serif,system-ui;margin:20px}pre{background:#f7f7f7;padding:12px;overflow:auto}code{white-space:pre-wrap}</style>
</head><body>
<h1>Hook 详情</h1>
<p><a href="../">返回列表</a></p>
<ul>
  <li>名称：<strong>${this.escapeHtml(rec.name)}</strong></li>
  <li>状态：${rec.status}</li>
  <li>耗时：${rec.durationMs} ms</li>
  <li>时间：${new Date(rec.startTs).toLocaleString()}</li>
  <li>发起位置：${this.escapeHtml([rec.originFile, rec.originLine].filter(Boolean).join(':'))}</li>
  <li>接收处理器：${this.escapeHtml([rec.receiverPluginName, rec.receiverPhase].filter(Boolean).join(' / '))}</li>
  <li>注册ID：${this.escapeHtml(rec.receiverId ?? '')}</li>
  <li>进程ID：${rec.processId ?? ''}</li>
</ul>
<h2>Payload</h2>
<pre><code>${payload}</code></pre>
<h2>Result</h2>
<pre><code>${result}</code></pre>
<h2>Stack</h2>
<ul>${stack}</ul>
</body></html>`;
  }

  private renderStats(items: HookMonitorStatsItem[], name?: string): string {
    const rows = items
      .map(
        (s) => `<tr>
          <td><a href="./?name=${encodeURIComponent(s.name)}">${this.escapeHtml(s.name)}</a></td>
          <td>${s.count}</td>
          <td>${s.avgMs} ms</td>
          <td>${s.p95Ms} ms</td>
          <td>${s.success}</td>
          <td>${s.error}</td>
          <td>${s.skipped}</td>
        </tr>`,
      )
      .join('');
    return `<!doctype html>
<html><head><meta charset="utf-8" /><title>Hook 统计</title>
<style>body{font-family:ui-sans-serif,system-ui;margin:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px}th{background:#f5f5f5;text-align:left}</style>
</head><body>
<h1>Hook 统计${name ? ` - ${this.escapeHtml(name)}` : ''}</h1>
<p><a href="./">返回列表</a></p>
<table>
  <thead><tr><th>名称</th><th>次数</th><th>平均</th><th>P95</th><th>成功</th><th>错误</th><th>跳过</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="7">暂无数据</td></tr>'}</tbody>
</table>
</body></html>`;
  }
}
