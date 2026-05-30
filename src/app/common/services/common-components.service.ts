import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { HookComponent } from '@/core/hookbus/decorators/hook-component.decorator';

/**
 * 统计看板组件 payload schema — 数组，每项指定 hook name 与卡片标题。
 * @keyword-en count-board-payload-schema
 */
const countBoardPayloadSchema = z
  .array(
    z.object({
      hook: z
        .string()
        .describe(
          'Hook 名称，该 Hook 应返回 { count: number }，如 saas.app.identity.roleCount',
        ),
      title: z.string().describe('卡片标题，如 "角色"、"用户"、"待办"'),
      color: z
        .string()
        .optional()
        .describe('卡片强调色 (CSS 颜色值)，不传自动轮换'),
      params: z
        .record(z.string(), z.unknown())
        .optional()
        .describe(
          '传给 Hook 的过滤参数，如 { status: "pending" }；不传则调用无过滤统计',
        ),
    }),
  )
  .describe('统计项列表');

/**
 * @title Common Components Service
 * @description SaaS 侧公共 Web Component Hook 声明。
 *              countBoard 组件读取 payload 数组里每项的 hook 名，
 *              经注入的 ctx.callHook 动态调用各 Hook 拿到数量（SaaS 自动路由 + 注入鉴权），
 *              以网格卡片展示并配数字滚动动画。
 * @keywords-cn 公共组件, 统计看板, 数字滚动, Web组件Hook声明
 * @keywords-en common-components, count-board, number-animation, web-component-hook-declaration
 */
@Injectable()
export class CommonComponentsService {
  /**
   * Web Component Hook: saas.app.common.countBoard
   * 以网格卡片展示多个统计数字，支持指定任意 Hook 获取 count 值，附数字滚动动画。
   * 经 ctx.callHook 调用各 Hook（render 第三参注入，SaaS 自动路由 + 注入鉴权，组件不碰 URL/token）。
   * @keyword-en count-board-web-component, stats-grid
   */
  @HookComponent('saas.app.common.countBoard', {
    description:
      '网格卡片展示多个统计数字，每项对应一个返回 { count: number } 的 Hook。' +
      'payload 为数组，每项格式: { hook: string, title: string, color?: string }。' +
      '内置数字滚动动画；经 ctx.callHook 动态调用各 Hook 鉴权获取数据，无需 LLM 手动查询。',
    tags: ['common', 'stats', 'component'],
    payloadSchema: countBoardPayloadSchema,
  })
  readonly countBoard = /* js */ `
/**
 * saas.app.common.countBoard — 统计看板（极简黑白 + 渐隐位滚动）
 * payload: Array<{ hook: string, title: string, params?: object }>
 */
export function render(el, payload, ctx) {
  var items = Array.isArray(payload) ? payload : [];
  if (!items.length) {
    el.innerHTML = '<div style="color:#a1a1aa;padding:8px;font-size:12px">—</div>';
    return;
  }

  /* 字号 / 行高常量 */
  var DH = 54;   /* 每一位槽的高度 (px)，决定动画距离 */
  var FS = 42;   /* 数字字号 */

  /* 渐隐 mask：让滚动时上下边缘柔和淡出 */
  var MASK =
    'linear-gradient(to bottom,' +
    'transparent 0%,#000 22%,#000 78%,transparent 100%)';

  /* ── 外层行容器 ─────────────────────────────────────────────────── */
  var wrap = document.createElement('div');
  wrap.style.cssText =
    'display:inline-flex;align-items:center;' +
    'font-family:-apple-system,"SF Pro Display","Helvetica Neue",Arial,sans-serif;' +
    '-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility';

  var refs = [];

  items.forEach(function(item, i) {
    /* ── 渐变分割线 ─────────────────────────────────────────────── */
    if (i > 0) {
      var sep = document.createElement('div');
      sep.style.cssText =
        'width:1px;height:40px;flex-shrink:0;align-self:center;' +
        'background:linear-gradient(to bottom,' +
        'transparent 0%,#d4d4d8 35%,#d4d4d8 65%,transparent 100%)';
      wrap.appendChild(sep);
    }

    var pl = i === 0 ? '0' : '32px';
    var pr = i === items.length - 1 ? '0' : '32px';

    var cell = document.createElement('div');
    cell.style.cssText =
      'display:flex;flex-direction:column;align-items:flex-start;' +
      'padding:0 ' + pr + ' 0 ' + pl;

    /* ── 数字占位容器 ────────────────────────────────────────────── */
    var numWrap = document.createElement('div');
    numWrap.style.cssText =
      'display:flex;align-items:center;height:' + DH + 'px;' +
      'overflow:hidden;margin-bottom:7px;' +
      '-webkit-mask-image:' + MASK + ';mask-image:' + MASK;
    /* 加载占位：浅灰"0" */
    numWrap.innerHTML =
      '<span style="font-size:' + FS + 'px;font-weight:800;color:#e4e4e7;' +
      'line-height:1;letter-spacing:-1.5px;font-variant-numeric:tabular-nums">0</span>';

    /* ── 标签 ────────────────────────────────────────────────────── */
    var lbl = document.createElement('div');
    lbl.style.cssText =
      'font-size:10.5px;color:#a1a1aa;font-weight:500;' +
      'text-transform:uppercase;letter-spacing:1.4px;white-space:nowrap';
    lbl.textContent = item.title ?? '-';

    cell.appendChild(numWrap);
    cell.appendChild(lbl);
    wrap.appendChild(cell);
    refs.push(numWrap);
  });

  el.innerHTML = '';
  el.appendChild(wrap);

  /* ── 位滚动 odometer ─────────────────────────────────────────── */
  function buildOdometer(container, num) {
    var s = String(Math.max(0, Math.floor(num)));
    container.innerHTML = '';
    container.style.cssText =
      'display:flex;align-items:center;height:' + DH + 'px;' +
      'overflow:hidden;margin-bottom:7px;gap:0;' +
      '-webkit-mask-image:' + MASK + ';mask-image:' + MASK;

    var strips = [];

    s.split('').forEach(function(ch) {
      var target = parseInt(ch, 10);

      var slot = document.createElement('div');
      slot.style.cssText = 'height:' + DH + 'px;overflow:hidden;flex-shrink:0';

      var strip = document.createElement('div');
      strip.style.cssText =
        'display:flex;flex-direction:column;' +
        'transform:translateY(0);will-change:transform';

      /* 0–9 再补一个 0，方便"滚过头"弹回的质感 */
      for (var n = 0; n <= 10; n++) {
        var d = document.createElement('div');
        d.style.cssText =
          'height:' + DH + 'px;display:flex;align-items:center;justify-content:center;' +
          'font-size:' + FS + 'px;font-weight:800;color:#09090b;line-height:1;' +
          'font-variant-numeric:tabular-nums;letter-spacing:-1.5px;' +
          '-webkit-font-smoothing:antialiased';
        d.textContent = String(n % 10);
        strip.appendChild(d);
      }

      slot.appendChild(strip);
      container.appendChild(slot);
      strips.push({ strip: strip, target: target });
    });

    /* 双 rAF 确保首帧已绘制再启动 transition */
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        strips.forEach(function(item, idx) {
          item.strip.style.transition =
            'transform .9s cubic-bezier(0.22,1,0.36,1)';
          item.strip.style.transitionDelay = (idx * 60) + 'ms';
          item.strip.style.transform =
            'translateY(-' + (item.target * DH) + 'px)';
        });
      });
    });
  }

  /* ── 并行拉取数据（经 ctx.callHook 路由 + 注入鉴权，组件不碰 URL/token）── */
  /* ctx.callHook 直接返回 hook 数据（已拆 {ok,data} 信封），失败 reject */
  items.forEach(function(item, i) {
    var numWrap = refs[i];
    ctx.callHook(item.hook, item.params ?? {})
      .then(function(raw) {
        var n = raw && raw.count != null ? Number(raw.count) : 0;
        buildOdometer(numWrap, isNaN(n) ? 0 : n);
      })
      .catch(function() {
        numWrap.innerHTML =
          '<span style="font-size:32px;font-weight:700;color:#d4d4d8;line-height:1">—</span>';
      });
  });
}
`;
}
