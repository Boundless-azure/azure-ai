import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { HookComponent } from '@/core/hookbus/decorators/hook-component.decorator';

/**
 * 用户表格组件 payload schema — q/tenantId/type 三维过滤，与 saas.app.identity.userList 对齐。
 * @keyword-en user-table-payload-schema
 */
const userTablePayloadSchema = z.object({
  q: z.string().optional().describe('模糊匹配 displayName / email / phone'),
  tenantId: z.string().optional().describe('按所属租户/组织 ID 过滤'),
  type: z
    .enum(['user', 'user_consumer', 'system'])
    .optional()
    .describe(
      '按类型过滤: user=企业用户, user_consumer=消费者, system=系统账号; 不传返回全部',
    ),
});

/**
 * @title Identity Components Service
 * @description SaaS 侧 identity 模块的 Web Component Hook 声明。
 *              每个 @HookComponent 属性会被 HookComponentExplorerService 在启动时自动注册到
 *              HookComponentRegistryService 和 HookBus（isComponent=true, denyLlm=true）。
 *              LLM 通过 search_hook({ tag: "component" }) 发现这些组件，
 *              在回复里输出 hook fence 触发前端渲染，无需自己查数据。
 * @keywords-cn 身份模块组件, 用户表格组件, Web组件Hook声明
 * @keywords-en identity-components, user-table-component, web-component-hook-declaration
 */
/**
 * 角色表格组件 payload schema — q/organizationId 过滤。
 * @keyword-en role-table-payload-schema
 */
const roleTablePayloadSchema = z.object({
  q: z.string().optional().describe('模糊匹配角色名称或标识符 (name / code)'),
  organizationId: z
    .string()
    .optional()
    .describe('按组织 ID 过滤；传 "null" 只返回系统级角色；不传返回全部'),
});

@Injectable()
export class IdentityComponentsService {
  /**
   * Web Component Hook: saas.app.identity.userTable
   * 以表格形式展示用户列表，支持 q / tenantId / type 三维实时过滤。
   * 组件直接调用 /api/identity/users 接口，从 localStorage 读取 Bearer token 鉴权。
   * @keyword-en user-table-web-component
   */
  @HookComponent('saas.app.identity.userTable', {
    description:
      '表格形式展示用户列表 (displayName/email/type/状态/最近登录)。' +
      '支持 q (模糊搜索)、tenantId (按组织过滤)、type (user/user_consumer/system) 三维实时过滤。' +
      '组件自带数据获取，LLM 只需在 payload 里填筛选条件即可，无需手动调 userList hook。',
    tags: ['identity', 'user', 'component'],
    payloadSchema: userTablePayloadSchema,
  })
  readonly userTable = /* js */ `
/**
 * saas.app.identity.userTable — 用户列表表格组件
 * payload: { q?: string, tenantId?: string, type?: 'user'|'user_consumer'|'system' }
 */
export function render(el, payload) {
  const { q = '', tenantId = '', type = '' } = payload ?? {};

  const params = new URLSearchParams();
  if (q)        params.set('q', q);
  if (tenantId) params.set('tenantId', tenantId);
  if (type)     params.set('type', type);
  const qs = params.toString();
  const API = (window.__apiBase ?? '/api');
  const url = API + '/identity/users' + (qs ? '?' + qs : '');

  const css = {
    wrap:    'overflow:auto;border-radius:8px;border:1px solid #e5e7eb;font-family:inherit',
    table:   'width:100%;border-collapse:collapse',
    thead:   'background:#f9fafb',
    th:      'padding:8px 14px;text-align:left;font-size:12px;color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb;white-space:nowrap',
    td:      'padding:9px 14px;font-size:13px;border-bottom:1px solid #f3f4f6;white-space:nowrap',
    loading: 'padding:16px;color:#9ca3af;font-size:13px',
    empty:   'padding:16px;color:#9ca3af;font-size:13px;text-align:center',
    err:     'padding:12px;color:#ef4444;font-size:13px',
  };

  el.innerHTML = \`<div style="\${css.loading}">加载中…</div>\`;

  const typeLabel = t =>
    ({ user: '企业用户', user_consumer: '消费者', system: '系统账号' }[t] ?? t ?? '-');

  const statusBadge = active =>
    active !== false
      ? '<span style="color:#16a34a;font-size:12px">● 启用</span>'
      : '<span style="color:#9ca3af;font-size:12px">○ 停用</span>';

  const timeLabel = t => {
    if (!t) return '-';
    try {
      return new Date(t).toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit',
        day: '2-digit', hour: '2-digit', minute: '2-digit',
      });
    } catch { return t; }
  };

  const token = localStorage.getItem('token');
  fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
  })
    .then(r => {
      if (!r.ok) return Promise.reject('HTTP ' + r.status);
      return r.json();
    })
    .then(rows => {
      if (!Array.isArray(rows) || !rows.length) {
        el.innerHTML = \`<div style="\${css.wrap}"><div style="\${css.empty}">暂无匹配用户</div></div>\`;
        return;
      }

      const trs = rows.map(u => \`
        <tr>
          <td style="\${css.td}">
            \${u.avatarUrl
              ? \`<img src="\${u.avatarUrl}" style="width:22px;height:22px;border-radius:50%;vertical-align:middle;margin-right:6px">\`
              : ''}
            \${u.displayName ?? '-'}
          </td>
          <td style="\${css.td};color:#4b5563">\${u.email ?? '-'}</td>
          <td style="\${css.td}">\${typeLabel(u.principalType)}</td>
          <td style="\${css.td}">\${statusBadge(u.active)}</td>
          <td style="\${css.td};color:#9ca3af;font-size:12px">\${timeLabel(u.lastLoginAt)}</td>
        </tr>
      \`).join('');

      el.innerHTML = \`
        <div style="\${css.wrap}">
          <table style="\${css.table}">
            <thead style="\${css.thead}">
              <tr>
                <th style="\${css.th}">用户</th>
                <th style="\${css.th}">邮箱</th>
                <th style="\${css.th}">类型</th>
                <th style="\${css.th}">状态</th>
                <th style="\${css.th}">最近登录</th>
              </tr>
            </thead>
            <tbody>\${trs}</tbody>
          </table>
          <div style="padding:6px 14px;font-size:11px;color:#d1d5db;text-align:right">共 \${rows.length} 条</div>
        </div>
      \`;
    })
    .catch(err => {
      el.innerHTML = \`<div style="\${css.wrap}"><div style="\${css.err}">加载失败：\${err}</div></div>\`;
    });
}
`;

  /**
   * Web Component Hook: saas.app.identity.roleTable
   * 以表格形式展示角色列表，支持 q / organizationId 过滤。
   * 组件直接调用 /api/identity/roles 接口，从 localStorage 读取 Bearer token 鉴权。
   * @keyword-en role-table-web-component
   */
  @HookComponent('saas.app.identity.roleTable', {
    description:
      '表格形式展示角色列表 (名称/标识符/说明/类型/创建时间)。' +
      '支持 q (模糊搜索名称或标识符)、organizationId (按组织过滤，传 "null" 只看系统级角色) 过滤。' +
      '组件自带数据获取，无需手动调 roleList hook。',
    tags: ['identity', 'role', 'component'],
    payloadSchema: roleTablePayloadSchema,
  })
  readonly roleTable = /* js */ `
/**
 * saas.app.identity.roleTable — 角色列表表格组件
 * payload: { q?: string, organizationId?: string }
 */
export function render(el, payload) {
  const { q = '', organizationId = '' } = payload ?? {};

  const params = new URLSearchParams();
  if (q)             params.set('q', q);
  if (organizationId) params.set('organizationId', organizationId);
  const qs = params.toString();
  const API = (window.__apiBase ?? '/api');
  const url = API + '/identity/roles' + (qs ? '?' + qs : '');

  const css = {
    wrap:    'overflow:auto;border-radius:8px;border:1px solid #e5e7eb;font-family:inherit',
    table:   'width:100%;border-collapse:collapse',
    thead:   'background:#f9fafb',
    th:      'padding:8px 14px;text-align:left;font-size:12px;color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb;white-space:nowrap',
    td:      'padding:9px 14px;font-size:13px;border-bottom:1px solid #f3f4f6;white-space:nowrap',
    loading: 'padding:16px;color:#9ca3af;font-size:13px',
    empty:   'padding:16px;color:#9ca3af;font-size:13px;text-align:center',
    err:     'padding:12px;color:#ef4444;font-size:13px',
    badge:   'display:inline-block;padding:1px 8px;border-radius:9999px;font-size:11px;font-weight:500',
  };

  el.innerHTML = \`<div style="\${css.loading}">加载中…</div>\`;

  const timeLabel = t => {
    if (!t) return '-';
    try {
      return new Date(t).toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit',
        day: '2-digit', hour: '2-digit', minute: '2-digit',
      });
    } catch { return t; }
  };

  const typeBadge = builtin =>
    builtin
      ? \`<span style="\${css.badge};background:#f0fdf4;color:#16a34a">内置</span>\`
      : \`<span style="\${css.badge};background:#f1f5f9;color:#64748b">自定义</span>\`;

  const token = localStorage.getItem('token');
  fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
  })
    .then(r => {
      if (!r.ok) return Promise.reject('HTTP ' + r.status);
      return r.json();
    })
    .then(resp => {
      const rows = Array.isArray(resp) ? resp : (resp?.data ?? resp?.items ?? []);
      if (!rows.length) {
        el.innerHTML = \`<div style="\${css.wrap}"><div style="\${css.empty}">暂无匹配角色</div></div>\`;
        return;
      }

      const trs = rows.map(r => \`
        <tr>
          <td style="\${css.td};font-weight:500">\${r.name ?? '-'}</td>
          <td style="\${css.td};color:#6b7280;font-family:monospace">\${r.code ?? '-'}</td>
          <td style="\${css.td};color:#4b5563;max-width:200px;overflow:hidden;text-overflow:ellipsis">\${r.description ?? '-'}</td>
          <td style="\${css.td}">\${typeBadge(r.builtin)}</td>
          <td style="\${css.td};color:#9ca3af;font-size:12px">\${timeLabel(r.createdAt)}</td>
        </tr>
      \`).join('');

      el.innerHTML = \`
        <div style="\${css.wrap}">
          <table style="\${css.table}">
            <thead style="\${css.thead}">
              <tr>
                <th style="\${css.th}">角色名称</th>
                <th style="\${css.th}">标识符</th>
                <th style="\${css.th}">说明</th>
                <th style="\${css.th}">类型</th>
                <th style="\${css.th}">创建时间</th>
              </tr>
            </thead>
            <tbody>\${trs}</tbody>
          </table>
          <div style="padding:6px 14px;font-size:11px;color:#d1d5db;text-align:right">共 \${rows.length} 条</div>
        </div>
      \`;
    })
    .catch(err => {
      el.innerHTML = \`<div style="\${css.wrap}"><div style="\${css.err}">加载失败：\${err}</div></div>\`;
    });
}
`;
}
