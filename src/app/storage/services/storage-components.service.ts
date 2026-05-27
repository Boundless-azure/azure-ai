import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { HookComponent } from '@/core/hookbus/decorators/hook-component.decorator';

/**
 * 文件列表组件 payload schema — path/q/type 过滤。
 * @keyword-en file-list-payload-schema
 */
const fileListPayloadSchema = z.object({
  path: z
    .string()
    .optional()
    .describe('目录路径，如 "/documents"; 不传返回根目录'),
  q: z.string().optional().describe('按文件名模糊搜索'),
  type: z
    .enum(['file', 'folder'])
    .optional()
    .describe('按节点类型过滤: file=只看文件, folder=只看文件夹; 不传全部'),
});

/**
 * @title Storage Components Service
 * @description SaaS 侧 storage 模块的 Web Component Hook 声明。
 *              @HookComponent 属性由 HookComponentExplorerService 在启动时自动注册。
 *              LLM 发现后在回复里输出 hook fence 触发前端渲染。
 *              点击文件直接在新标签打开；点击文件夹跳转右侧文件库到对应路径。
 * @keywords-cn 文件列表组件, 资源库组件, Web组件Hook声明
 * @keywords-en storage-components, file-list-component, web-component-hook-declaration
 */
@Injectable()
export class StorageComponentsService {
  /**
   * Web Component Hook: saas.app.storage.fileList
   * 以列表形式展示文件/文件夹，支持 path / q / type 过滤。
   * 点击文件新标签打开；点击文件夹派发 hookComponent:navigate 事件跳转右侧文件库。
   * 组件直接调用 /api/storage/nodes 接口，从 localStorage 读取 Bearer token 鉴权。
   * @keyword-en file-list-web-component
   */
  @HookComponent('saas.app.storage.fileList', {
    description:
      '列表形式展示文件与文件夹 (名称/类型/大小/修改时间)。' +
      '支持 path (目录路径)、q (名称搜索)、type (file/folder) 过滤。' +
      '点击文件直接在新标签打开；点击文件夹在右侧文件库跳转到对应目录。' +
      '组件自带数据获取，无需手动调 storage.listNodes hook。',
    tags: ['storage', 'file', 'component'],
    payloadSchema: fileListPayloadSchema,
  })
  readonly fileList = /* js */ `
/**
 * saas.app.storage.fileList — 文件列表组件
 * payload: { path?: string, q?: string, type?: 'file'|'folder' }
 * 点击文件: 新标签打开 resourcePath
 * 点击文件夹: 派发 hookComponent:navigate 跳转右侧文件库
 */
export function render(el, payload) {
  const { path = '/', q = '', type = '' } = payload ?? {};

  const params = new URLSearchParams();
  if (path && path !== '/') params.set('path', path);
  if (q)    params.set('q', q);
  if (type) params.set('type', type);
  const qs = params.toString();
  const API = (window.__apiBase ?? '/api');
  const url = API + '/storage/nodes' + (qs ? '?' + qs : '');

  const css = {
    wrap:    'overflow:auto;border-radius:8px;border:1px solid #e5e7eb;font-family:inherit',
    table:   'width:100%;border-collapse:collapse',
    thead:   'background:#f9fafb',
    th:      'padding:8px 14px;text-align:left;font-size:12px;color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb;white-space:nowrap',
    td:      'padding:9px 14px;font-size:13px;border-bottom:1px solid #f3f4f6;white-space:nowrap',
    loading: 'padding:16px;color:#9ca3af;font-size:13px',
    empty:   'padding:16px;color:#9ca3af;font-size:13px;text-align:center',
    err:     'padding:12px;color:#ef4444;font-size:13px',
    link:    'cursor:pointer;color:#2563eb;text-decoration:underline',
    folder:  'cursor:pointer;color:#d97706',
  };

  el.innerHTML = \`<div style="\${css.loading}">加载中…</div>\`;

  const formatSize = bytes => {
    if (!bytes) return '-';
    const n = Number(bytes);
    if (isNaN(n)) return bytes;
    if (n < 1024)       return n + ' B';
    if (n < 1048576)    return (n / 1024).toFixed(1) + ' KB';
    if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  };

  const timeLabel = t => {
    if (!t) return '-';
    try {
      return new Date(t).toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit',
        day: '2-digit', hour: '2-digit', minute: '2-digit',
      });
    } catch { return t; }
  };

  const MIME_ICON = {
    'image/':       '🖼️',
    'video/':       '🎬',
    'audio/':       '🎵',
    'application/pdf': '📄',
    'text/':        '📝',
    'application/zip': '🗜️',
  };
  const fileIcon = mime => {
    if (!mime) return '📄';
    for (const [prefix, icon] of Object.entries(MIME_ICON)) {
      if (mime.startsWith(prefix)) return icon;
    }
    return '📄';
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
    .then(resp => {
      const nodes = Array.isArray(resp) ? resp : (resp?.data ?? resp?.items ?? []);
      // 文件夹优先，再按名称排序
      nodes.sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return (a.name ?? '').localeCompare(b.name ?? '');
      });

      if (!nodes.length) {
        el.innerHTML = \`<div style="\${css.wrap}"><div style="\${css.empty}">该目录为空</div></div>\`;
        return;
      }

      const tbody = document.createElement('tbody');
      nodes.forEach(node => {
        const tr = document.createElement('tr');
        const isFolder = node.type === 'folder';
        const icon = isFolder ? '📁' : fileIcon(node.mimeType);
        const nameStyle = isFolder ? css.folder : (node.resourcePath ? css.link : css.td);

        tr.innerHTML = \`
          <td style="\${css.td}">
            <span style="\${nameStyle}" data-action="\${isFolder ? 'folder' : 'file'}"
                  data-path="\${node.path ?? ''}" data-url="\${node.resourcePath ?? ''}">
              \${icon} \${node.name ?? '-'}
            </span>
          </td>
          <td style="\${css.td}">\${isFolder ? '文件夹' : '文件'}</td>
          <td style="\${css.td};color:#6b7280">\${formatSize(node.size)}</td>
          <td style="\${css.td};color:#9ca3af;font-size:12px">\${timeLabel(node.updatedAt)}</td>
        \`;
        tbody.appendChild(tr);
      });

      const table = document.createElement('table');
      table.style.cssText = css.table;
      table.innerHTML = \`
        <thead style="\${css.thead}">
          <tr>
            <th style="\${css.th}">名称</th>
            <th style="\${css.th}">类型</th>
            <th style="\${css.th}">大小</th>
            <th style="\${css.th}">修改时间</th>
          </tr>
        </thead>
      \`;
      table.appendChild(tbody);

      const footer = document.createElement('div');
      footer.style.cssText = 'padding:6px 14px;font-size:11px;color:#d1d5db;text-align:right';
      footer.textContent = '共 ' + nodes.length + ' 项';

      const wrap = document.createElement('div');
      wrap.style.cssText = css.wrap;
      wrap.appendChild(table);
      wrap.appendChild(footer);

      // 点击事件：文件 → 新标签打开；文件夹 → 跳转右侧文件库
      wrap.addEventListener('click', e => {
        const span = e.target.closest('[data-action]');
        if (!span) return;
        const action = span.dataset.action;
        if (action === 'file') {
          const raw = span.dataset.url;
          if (raw) {
            const base = window.__apiBase ?? '/api';
            const fileUrl = raw.startsWith('http') ? raw : base + raw;
            window.open(fileUrl, '_blank');
          }
        } else if (action === 'folder') {
          const folderPath = span.dataset.path || '/';
          window.dispatchEvent(new CustomEvent('hookComponent:navigate', {
            detail: { tab: 'storage', label: '文件库', props: { jumpRequest: { path: folderPath, ts: Date.now() } } },
          }));
        }
      });

      el.innerHTML = '';
      el.appendChild(wrap);
    })
    .catch(err => {
      el.innerHTML = \`<div style="\${css.wrap}"><div style="\${css.err}">加载失败：\${err}</div></div>\`;
    });
}
`;
}
