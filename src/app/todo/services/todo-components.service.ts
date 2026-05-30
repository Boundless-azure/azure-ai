import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { HookComponent } from '@/core/hookbus/decorators/hook-component.decorator';

/**
 * 待办表格组件 payload schema — q/status/sessionId 过滤。
 * @keyword-en todo-table-payload-schema
 */
const todoTablePayloadSchema = z.object({
  q: z.string().optional().describe('关键字搜索标题'),
  status: z
    .enum([
      'pending',
      'in_progress',
      'failed',
      'waiting_acceptance',
      'completed',
    ])
    .optional()
    .describe(
      '按状态过滤: pending/in_progress/failed/waiting_acceptance/completed; 不传返回全部',
    ),
  sessionId: z
    .string()
    .optional()
    .describe('按关联会话 ID 过滤；不传返回全局待办'),
});

/**
 * @title Todo Components Service
 * @description SaaS 侧 todo 模块的 Web Component Hook 声明。
 *              @HookComponent 属性由 HookComponentExplorerService 在启动时自动注册。
 *              LLM 发现后在回复里输出 hook fence 触发前端渲染，无需自己查数据。
 * @keywords-cn 待办组件, 任务表格组件, Web组件Hook声明
 * @keywords-en todo-components, todo-table-component, web-component-hook-declaration
 */
@Injectable()
export class TodoComponentsService {
  /**
   * Web Component Hook: saas.app.todo.todoTable
   * 以表格形式展示待办列表，支持 q / status / sessionId 过滤。
   * 经 ctx.callHook('saas.app.todo.list', params) 获取数据（SaaS 自动路由 + 注入鉴权，组件不碰 URL/token）。
   * @keyword-en todo-table-web-component
   */
  @HookComponent('saas.app.todo.todoTable', {
    description:
      '表格形式展示待办列表 (标题/状态/说明/创建时间)。' +
      '支持 q (关键字)、status (pending/in_progress/failed/waiting_acceptance/completed)、sessionId 过滤。' +
      '组件自带数据获取，无需手动调 todo.list hook。',
    tags: ['todo', 'task', 'component'],
    payloadSchema: todoTablePayloadSchema,
  })
  readonly todoTable = /* js */ `
/**
 * saas.app.todo.todoTable — 待办列表表格组件
 * payload: { q?: string, status?: string, sessionId?: string }
 */
export function render(el, payload, ctx) {
  var { q = '', status = '', sessionId = '' } = payload ?? {};

  var p = {};
  if (q)         p.q = q;
  if (status)    p.status = status;
  if (sessionId) p.sessionId = sessionId;

  var css = {
    wrap:    'overflow:auto;border-radius:8px;border:1px solid #e5e7eb;font-family:inherit',
    table:   'width:100%;border-collapse:collapse',
    thead:   'background:#f9fafb',
    th:      'padding:8px 14px;text-align:left;font-size:12px;color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb;white-space:nowrap',
    td:      'padding:9px 14px;font-size:13px;border-bottom:1px solid #f3f4f6',
    loading: 'padding:16px;color:#9ca3af;font-size:13px',
    empty:   'padding:16px;color:#9ca3af;font-size:13px;text-align:center',
    err:     'padding:12px;color:#ef4444;font-size:13px',
  };

  el.innerHTML = '<div style="' + css.loading + '">加载中…</div>';

  var STATUS_MAP = {
    pending:            { label: '未开始',  bg: '#f1f5f9', color: '#64748b' },
    in_progress:        { label: '进行中',  bg: '#eff6ff', color: '#2563eb' },
    failed:             { label: '失败',    bg: '#fef2f2', color: '#dc2626' },
    waiting_acceptance: { label: '待验收',  bg: '#fffbeb', color: '#d97706' },
    completed:          { label: '已完成',  bg: '#f0fdf4', color: '#16a34a' },
  };

  var statusBadge = function(s, color) {
    var info = STATUS_MAP[s];
    var bg    = info ? info.bg    : (color || '#f1f5f9');
    var fg    = info ? info.color : '#374151';
    var label = info ? info.label : (s ?? '-');
    return '<span style="display:inline-block;padding:1px 8px;border-radius:9999px;font-size:11px;font-weight:500;background:' + bg + ';color:' + fg + '">' + label + '</span>';
  };

  var timeLabel = function(t) {
    if (!t) return '-';
    try {
      return new Date(t).toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit',
        day: '2-digit', hour: '2-digit', minute: '2-digit',
      });
    } catch (e) { return t; }
  };

  ctx.callHook('saas.app.todo.list', p)
    .then(function(raw) {
      var rows = Array.isArray(raw) ? raw : (raw?.data ?? raw?.items ?? []);
      if (!rows.length) {
        el.innerHTML = '<div style="' + css.wrap + '"><div style="' + css.empty + '">暂无匹配待办</div></div>';
        return;
      }

      var trs = rows.map(function(t) {
        return '<tr>' +
          '<td style="' + css.td + ';font-weight:500;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (t.title ?? '-') + '</td>' +
          '<td style="' + css.td + ';white-space:nowrap">' + statusBadge(t.status, t.statusColor) + '</td>' +
          '<td style="' + css.td + ';color:#6b7280;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (t.description ?? '-') + '</td>' +
          '<td style="' + css.td + ';color:#9ca3af;font-size:12px;white-space:nowrap">' + timeLabel(t.createdAt) + '</td>' +
          '</tr>';
      }).join('');

      el.innerHTML =
        '<div style="' + css.wrap + '">' +
          '<table style="' + css.table + '">' +
            '<thead style="' + css.thead + '">' +
              '<tr>' +
                '<th style="' + css.th + '">标题</th>' +
                '<th style="' + css.th + '">状态</th>' +
                '<th style="' + css.th + '">说明</th>' +
                '<th style="' + css.th + '">创建时间</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' + trs + '</tbody>' +
          '</table>' +
          '<div style="padding:6px 14px;font-size:11px;color:#d1d5db;text-align:right">共 ' + rows.length + ' 条</div>' +
        '</div>';
    })
    .catch(function(err) {
      el.innerHTML = '<div style="' + css.wrap + '"><div style="' + css.err + '">加载失败：' + err + '</div></div>';
    });
}
`;
}
