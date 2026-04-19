/**
 * @title WebMCP 前端客户端 SDK
 * @description 纯 JS 独立脚本，无任何构建依赖。SaaS 页面通过 <script> 标签引入后
 *   调用 window.WebMCP.initWebMCP() 初始化，注册 <webmcp-float> 和 <webmcp-debug>
 *   两个 Web Components。
 *
 * 使用方式:
 *   <script src="webmcp-client.sdk.js"></script>
 *   <script>
 *     const mcp = window.WebMCP.initWebMCP({ pageName: 'MyPage', pageDesc: '...' });
 *     mcp.setData({ '$count$': { name: '计数', desc: '当前计数', handle: () => count } });
 *     mcp.setEmit({ '$reset$': { name: '重置', desc: '重置计数', handle: () => { count = 0 } } });
 *     window.WebMCP.registerWebMCPComponents();
 *   </script>
 *   <webmcp-float></webmcp-float>
 *   <webmcp-debug></webmcp-debug>
 *
 * @keyword-en webmcp-sdk, init, setData, setEmit, web-components, standalone
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.WebMCP = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ========== 工具函数 ==========

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function safeJsonParse(raw) {
    if (typeof raw !== 'string' || !raw.trim()) return undefined;
    try { return JSON.parse(raw); } catch { return raw; }
  }

  function safeCall(fn) {
    try { return fn(); } catch { return undefined; }
  }

  /** 将任意 key 转为合法 CSS ID（替换非字母数字/连字符/下划线的字符） */
  function toSafeId(key) {
    return String(key).replace(/[^a-zA-Z0-9_-]/g, '-');
  }

  function isObject(val) {
    return val !== null && typeof val === 'object';
  }

  // ========== 核心初始化 ==========

  /**
   * 初始化 WebMCP SDK
   * @param {object} options
   * @param {string} options.pageName  页面唯一标识名称
   * @param {string} options.pageDesc  页面描述
   * @param {string} [options.serverUrl]  WebSocket 服务器地址，默认 window.location.origin
   * @returns {WebMcpInstance}
   * @keyword-en init-webmcp-sdk
   */
  function initWebMCP(options) {
    var pageName = options.pageName;
    var pageDesc = options.pageDesc;
    var serverUrl = options.serverUrl;

    var dataMap  = new Map();
    var emitMap  = new Map();
    var childMap = new Map();
    var socket   = null;

    // ---- schema validation（支持 Zod duck-type 或简单 plain-schema）----

    function validateSchema(schema, payload) {
      if (!schema) return { ok: true };
      // Zod duck-type: 有 safeParse 方法
      if (typeof schema.safeParse === 'function') {
        var r = schema.safeParse(payload);
        return r.success ? { ok: true } : { ok: false, error: (r.error && r.error.message) || 'validation failed' };
      }
      if (schema.type === 'void' || schema.type === 'any') return { ok: true };
      if (schema.type && schema.type !== 'array') {
        if (typeof payload !== schema.type) {
          return { ok: false, error: 'expected ' + schema.type + ', got ' + typeof payload };
        }
      }
      if (schema.type === 'array' && !Array.isArray(payload)) {
        return { ok: false, error: 'expected array' };
      }
      if (schema.enum && !schema.enum.includes(payload)) {
        return { ok: false, error: 'must be one of: ' + schema.enum.join(', ') };
      }
      return { ok: true };
    }

    /**
     * 序列化 schema 到可传输的描述对象。
     * - plain schema: { type, enum?, properties? } → 直接 JSON 拷贝
     * - Zod schema: duck-type 检测 safeParse，尝试从 _def 提取类型信息
     * @keyword-en serialize-schema-zod
     */
    function serializeSchema(schema) {
      if (!schema) return undefined;
      // Zod duck-type 检测
      if (typeof schema.safeParse === 'function') {
        return serializeZodSchema(schema);
      }
      try { return JSON.parse(JSON.stringify(schema)); } catch { return undefined; }
    }

    /**
     * 从 Zod schema 的 _def 中提取可读描述结构
     * 支持: ZodString, ZodNumber, ZodBoolean, ZodArray, ZodObject, ZodEnum,
     *       ZodOptional, ZodNullable, ZodLiteral, ZodUnion, ZodRecord
     * @keyword-en serialize-zod-schema-def
     */
    function serializeZodSchema(schema) {
      if (!schema || !schema._def) return { type: 'zod' };
      var def = schema._def;
      var typeName = def.typeName || '';

      if (typeName === 'ZodString')  return { type: 'string',  zod: true, checks: (def.checks || []).map(function(c){ return c.kind; }) };
      if (typeName === 'ZodNumber')  return { type: 'number',  zod: true, checks: (def.checks || []).map(function(c){ return c.kind; }) };
      if (typeName === 'ZodBoolean') return { type: 'boolean', zod: true };
      if (typeName === 'ZodDate')    return { type: 'date',    zod: true };
      if (typeName === 'ZodAny')     return { type: 'any',     zod: true };
      if (typeName === 'ZodVoid')    return { type: 'void',    zod: true };
      if (typeName === 'ZodNull')    return { type: 'null',    zod: true };
      if (typeName === 'ZodUndefined') return { type: 'undefined', zod: true };

      if (typeName === 'ZodLiteral') return { type: 'literal', value: def.value, zod: true };

      if (typeName === 'ZodEnum') {
        var vals = def.values || [];
        return { type: 'enum', enum: Array.isArray(vals) ? vals : Object.values(vals), zod: true };
      }

      if (typeName === 'ZodNativeEnum') {
        var ev = def.values || {};
        return { type: 'enum', enum: Object.values(ev).filter(function(v){ return typeof v !== 'number'; }), zod: true };
      }

      if (typeName === 'ZodArray') {
        return { type: 'array', items: serializeZodSchema(def.type), zod: true };
      }

      if (typeName === 'ZodObject') {
        var shape = typeof def.shape === 'function' ? def.shape() : (def.shape || {});
        var props = {};
        Object.keys(shape).forEach(function(k) { props[k] = serializeZodSchema(shape[k]); });
        return { type: 'object', properties: props, zod: true };
      }

      if (typeName === 'ZodRecord') {
        return { type: 'record', valueSchema: serializeZodSchema(def.valueType), zod: true };
      }

      if (typeName === 'ZodOptional' || typeName === 'ZodNullable') {
        var inner = serializeZodSchema(def.innerType);
        return Object.assign({}, inner, { optional: true, zod: true });
      }

      if (typeName === 'ZodDefault') {
        var di = serializeZodSchema(def.innerType);
        return Object.assign({}, di, { default: def.defaultValue ? def.defaultValue() : undefined, zod: true });
      }

      if (typeName === 'ZodUnion') {
        return { type: 'union', options: (def.options || []).map(serializeZodSchema), zod: true };
      }

      if (typeName === 'ZodDiscriminatedUnion') {
        return { type: 'discriminatedUnion', discriminator: def.discriminator, zod: true };
      }

      if (typeName === 'ZodIntersection') {
        return { type: 'intersection', left: serializeZodSchema(def.left), right: serializeZodSchema(def.right), zod: true };
      }

      if (typeName === 'ZodTuple') {
        return { type: 'tuple', items: (def.items || []).map(serializeZodSchema), zod: true };
      }

      // 兜底：描述类型名
      return { type: 'zod', typeName: typeName };
    }

    // ---- 取 data entry 当前值（兼容旧 handle-as-getter 写法）----

    function getEntryValue(entry) {
      if (typeof entry.value === 'function') return safeCall(entry.value);
      return safeCall(entry.handle); // backward compat
    }

    function getDescriptor() {
      return {
        pageName: pageName,
        pageDesc: pageDesc,
        data:  Array.from(dataMap.values()),
        emits: Array.from(emitMap.values()),
        children: Array.from(childMap.entries()).map(function (pair) {
          return { childKey: pair[0], descriptor: pair[1].descriptor };
        }),
      };
    }

    function buildWireDescriptor() {
      var desc = getDescriptor();
      return {
        pageName: desc.pageName,
        pageDesc: desc.pageDesc,
        data: desc.data.map(function (d) {
          return { key: d.key, name: d.name, desc: d.desc, value: getEntryValue(d), schema: serializeSchema(d.schema) };
        }),
        emits: desc.emits.map(function (e) {
          return { key: e.key, name: e.name, desc: e.desc, schema: serializeSchema(e.schema) };
        }),
        children: desc.children,
      };
    }

    function register() {
      if (!socket || !socket.connected) return;
      socket.emit('webmcp:register', { pageName: pageName, descriptor: buildWireDescriptor() });
    }

    function handleOp(op) {
      return Promise.resolve().then(function () {
        if (!isObject(op)) return { ok: false, error: 'invalid op' };

        if (op.op === 'callEmit') {
          var key = String(op.key || '');
          var entry = emitMap.get(key);
          if (!entry) return { ok: false, error: "emit '" + key + "' not found" };
          var args = Array.isArray(op.args) ? op.args : [];
          if (entry.schema && args.length > 0) {
            var pv = args.length === 1 ? args[0] : args;
            var sv = validateSchema(entry.schema, pv);
            if (!sv.ok) return { ok: false, error: 'schema: ' + sv.error };
          }
          return Promise.resolve().then(function () {
            return entry.handle.apply(null, args);
          }).then(function (ret) {
            return { ok: true, result: ret };
          }).catch(function (e) {
            return { ok: false, error: e instanceof Error ? e.message : String(e) };
          });
        }

        // setData → 直接调用 handle(payload) 作为 setter
        if (op.op === 'setData') {
          var key = String(op.key || '');
          var entry = dataMap.get(key);
          if (!entry) return { ok: false, error: "data '" + key + "' not found" };
          if (entry.schema) {
            var dv = validateSchema(entry.schema, op.value);
            if (!dv.ok) return { ok: false, error: 'schema: ' + dv.error };
          }
          return Promise.resolve().then(function () {
            return entry.handle(op.value);
          }).then(function () {
            return { ok: true };
          }).catch(function (e) {
            return { ok: false, error: String(e) };
          });
        }

        // 路由到子页面
        if (op.op === 'callChild') {
          var childKey = String(op.childKey || '');
          var child = childMap.get(childKey);
          if (!child) return { ok: false, error: "child '" + childKey + "' not found" };
          return child.executeOp(op.childOp || op);
        }

        return { ok: false, error: 'unknown op' };
      });
    }

    // ---- 子页面 iframe 支持 ----

    function _registerChildFrame(childKey, iframe) {
      var pending = new Map();
      var callSeq = 0;

      var child = {
        descriptor: null,
        executeOp: function (childOp) {
          return new Promise(function (resolve) {
            var id = ++callSeq;
            pending.set(id, resolve);
            iframe.contentWindow.postMessage({ type: 'webmcp:op', id: id, op: childOp }, '*');
            setTimeout(function () {
              if (pending.has(id)) { pending.delete(id); resolve({ ok: false, error: 'timeout' }); }
            }, 5000);
          });
        },
      };
      childMap.set(childKey, child);

      function onMsg(e) {
        if (e.source !== iframe.contentWindow) return;
        var d = e.data;
        if (!d || typeof d !== 'object') return;
        if (d.type === 'webmcp:child_ready') {
          child.descriptor = d.descriptor;
          register();
        }
        if (d.type === 'webmcp:op_result') {
          var cb = pending.get(d.id);
          if (cb) { pending.delete(d.id); cb(d.result); }
        }
      }
      window.addEventListener('message', onMsg);
      return function cleanup() {
        window.removeEventListener('message', onMsg);
        childMap.delete(childKey);
      };
    }

    function connectSocket() {
      var base = serverUrl || window.location.origin;
      var io = window.io;
      if (typeof io !== 'function') {
        console.warn('[WebMCP] socket.io not found on window.io');
        return;
      }
      socket = io(base + '/webmcp', {
        path: '/api/socket.io',
        transports: ['websocket'],
        withCredentials: true,
        auth: {
          token:     options.token     || '',
          sessionId: options.sessionId || '',
        },
      });
      socket.on('connect', function () { register(); });
      socket.on('webmcp:registered', function () { /* schema ack */ });
      // 服务端通过 Hook 下发的调用指令（携带 callId 用于响应等待）
      socket.on('webmcp:call', function (call) {
        if (!call || !call.payload) return;
        handleOp(call.payload).then(function (result) {
          socket.emit('webmcp:call_result', { callId: call.callId, result: result });
        });
      });
      // 向后兼容旧事件
      socket.on('webmcp/get', function () {
        socket.emit('webmcp/descriptor', buildWireDescriptor());
      });
      socket.on('webmcp/op', function (op) {
        handleOp(op).then(function (result) {
          socket.emit('webmcp/op_result', result);
        });
      });
    }

    connectSocket();

    var instance = {
      get pageName() { return pageName; },
      get pageDesc() { return pageDesc; },

      /**
       * 注册数据变量
       * 新格式：{ name, desc, schema?, value: () => T, handle: (payload: T) => void }
       * 旧格式（向后兼容）：{ name, desc, handle: () => T }（handle 作为 getter）
       * @keyword-en register-data-entries
       */
      setData: function (map) {
        Object.keys(map).forEach(function (key) {
          dataMap.set(key, Object.assign({ key: key }, map[key]));
        });
        register();
      },

      /**
       * 注册动作/事件
       * 支持 schema 字段进行 payload 校验：{ name, desc, schema?, handle: (payload) => any }
       * @keyword-en register-emit-entries
       */
      setEmit: function (map) {
        Object.keys(map).forEach(function (key) {
          emitMap.set(key, Object.assign({ key: key }, map[key]));
        });
        register();
      },

      /** @keyword-en get-descriptor */
      getDescriptor: getDescriptor,

      /** @keyword-en re-register */
      reRegister: function () { register(); },

      /**
       * 直接设置某个 data 的值（调用其 handle setter），供 Debug 面板使用
       * @keyword-en set-data-value-direct
       */
      setDataValue: function (key, value) {
        var entry = dataMap.get(String(key));
        if (!entry) return { ok: false, error: 'not found' };
        if (entry.schema) {
          var v = validateSchema(entry.schema, value);
          if (!v.ok) return { ok: false, error: v.error };
        }
        try { entry.handle(value); return { ok: true }; }
        catch (e) { return { ok: false, error: String(e) }; }
      },

      /**
       * 获取某个 data 的当前值
       * @keyword-en get-data-value
       */
      getDataValue: function (key) {
        var entry = dataMap.get(String(key));
        if (!entry) return undefined;
        return getEntryValue(entry);
      },

      /**
       * 注册子页面 iframe，监听其 webmcp:child_ready 消息
       * @param {string} childKey  子页面唯一标识
       * @param {HTMLIFrameElement} iframe
       * @returns {function} cleanup 清理函数
       * @keyword-en register-child-frame
       */
      registerChildFrame: function (childKey, iframe) {
        return _registerChildFrame(childKey, iframe);
      },
    };

    window.__webmcp__ = instance;

    // ========== 预置系统事件注册 sys-builtins ==========
    var _metaStore = {};

    instance.setData({
      /**
       * 获取当前页面注册信息与 origin 信息
       * @keyword-en sys-page-info
       */
      '$sys.page_info$': {
        name: '页面注册信息', desc: '当前 MCP 页面名称、描述及 origin/URL 信息',
        value: function () {
          return {
            pageName:  pageName,
            pageDesc:  pageDesc,
            origin:    window.location.origin,
            href:      window.location.href,
            pathname:  window.location.pathname,
            referrer:  document.referrer || null,
            title:     document.title,
          };
        },
        handle: function () { /* 只读 */ },
      },

      /**
       * 获取当前设备信息
       * @keyword-en sys-device-info
       */
      '$sys.device$': {
        name: '设备信息', desc: '浏览器/设备环境信息',
        value: function () {
          return {
            userAgent:   navigator.userAgent,
            platform:    navigator.platform,
            language:    navigator.language,
            online:      navigator.onLine,
            screenW:     window.screen.width,
            screenH:     window.screen.height,
            viewportW:   window.innerWidth,
            viewportH:   window.innerHeight,
            timezone:    Intl.DateTimeFormat().resolvedOptions().timeZone,
            colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
          };
        },
        handle: function () { /* 只读 */ },
      },

      /**
       * 当前页面全量 data 快照（用于判断页面是否切换）
       * @keyword-en sys-page-data-snapshot
       */
      '$sys.page_data$': {
        name: '页面数据快照', desc: '当前页面所有已注册 data key 及其实时值',
        value: function () {
          var snap = {};
          dataMap.forEach(function (entry, key) {
            if (key.indexOf('$sys.') === 0) return; // 排除 sys 自身
            try { snap[key] = getEntryValue(entry); } catch (e) { snap[key] = null; }
          });
          return snap;
        },
        handle: function () { /* 只读 */ },
      },

      /**
       * Meta 信息（前端可通过 SDK 同步修改）
       * @keyword-en sys-meta-info
       */
      '$sys.meta$': {
        name: 'Meta 信息', desc: '前端可读写的预置 meta 信息，SDK 通过 setDataValue 修改',
        value: function () { return Object.assign({}, _metaStore); },
        handle: function (v) {
          if (v && typeof v === 'object') Object.assign(_metaStore, v);
        },
      },
    });

    return instance;
  }

  // ========== 共享 CSS 令牌（iOS 黑白风格）==========

  var SHARED_CSS = [
    '--bg: rgba(28,28,30,0.92)',
    '--bg-card: rgba(44,44,46,0.95)',
    '--bg-input: rgba(58,58,60,0.8)',
    '--border: rgba(255,255,255,0.1)',
    '--text: #f5f5f7',
    '--text-sub: rgba(235,235,245,0.55)',
    '--accent: #ffffff',
    '--ball-bg: rgba(28,28,30,0.88)',
    '--ball-border: rgba(255,255,255,0.18)',
    '--send-bg: #ffffff',
    '--send-color: #000000',
    '--user-bubble: rgba(255,255,255,0.12)',
    '--ai-bubble: rgba(255,255,255,0.07)',
    '--radius-panel: 20px',
    '--shadow-panel: 0 24px 64px rgba(0,0,0,0.6), 0 4px 24px rgba(0,0,0,0.4)',
  ].join(';');

  var BALL_CSS = '\n' + [
    ':host { position: fixed; z-index: 9998; pointer-events: none; inset: 0; }',
    '*, *::before, *::after { box-sizing: border-box; }',
    ':host { ' + SHARED_CSS + '; }',
    '.ball {',
    '  position: absolute;',
    '  width: 48px; height: 48px; border-radius: 50%;',
    '  background: var(--ball-bg);',
    '  backdrop-filter: blur(20px) saturate(1.8);',
    '  -webkit-backdrop-filter: blur(20px) saturate(1.8);',
    '  border: 1px solid var(--ball-border);',
    '  box-shadow: 0 4px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.15);',
    '  cursor: pointer; pointer-events: auto;',
    '  display: flex; align-items: center; justify-content: center;',
    '  transition: box-shadow 0.2s ease, transform 0.18s ease;',
    '  user-select: none; will-change: transform;',
    '}',
    '.ball:hover { box-shadow: 0 6px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.2); transform: scale(1.04); }',
    '.ball:active { transform: scale(0.96); }',
    '.ball-icon { font-size: 20px; line-height: 1; }',
    '.ball.locked { cursor: default; }',
    '.overlay {',
    '  position: fixed; inset: 0;',
    '  background: rgba(0,0,0,0.5);',
    '  backdrop-filter: blur(2px);',
    '  pointer-events: none; opacity: 0;',
    '  transition: opacity 0.3s cubic-bezier(0.4,0,0.2,1);',
    '}',
    '.overlay.show { opacity: 1; pointer-events: auto; }',
    '.panel {',
    '  position: fixed; top: 0; bottom: 0;',
    '  width: 360px; max-width: 92vw;',
    '  background: var(--bg);',
    '  backdrop-filter: blur(40px) saturate(2);',
    '  -webkit-backdrop-filter: blur(40px) saturate(2);',
    '  border-right: 1px solid var(--border);',
    '  box-shadow: var(--shadow-panel);',
    '  display: flex; flex-direction: column;',
    '  will-change: transform; pointer-events: auto;',
    '  transition: transform 0.46s cubic-bezier(0.34,1.12,0.64,1);',
    '}',
    '.panel.from-right { left: auto; right: 0; border-right: none; border-left: 1px solid var(--border); transform: translateX(110%); }',
    '.panel.from-left { left: 0; transform: translateX(-110%); }',
    '.panel.open { transform: translateX(0) !important; }',
    '.panel-header {',
    '  padding: 16px 16px 12px;',
    '  display: flex; align-items: center; gap: 12px;',
    '  border-bottom: 1px solid var(--border);',
    '  flex-shrink: 0;',
    '}',
    '.header-icon {',
    '  width: 34px; height: 34px; border-radius: 50%;',
    '  background: rgba(255,255,255,0.1);',
    '  border: 1px solid rgba(255,255,255,0.15);',
    '  display: flex; align-items: center; justify-content: center;',
    '  font-size: 17px; flex-shrink: 0;',
    '}',
    '.header-info { flex: 1; min-width: 0; }',
    '.header-title { font-size: 15px; font-weight: 600; color: var(--text); letter-spacing: -0.01em; }',
    '.header-sub { font-size: 11px; color: var(--text-sub); margin-top: 1px; }',
    '.close-btn {',
    '  width: 30px; height: 30px; border-radius: 50%;',
    '  background: rgba(255,255,255,0.1);',
    '  border: none; cursor: pointer; color: var(--text);',
    '  display: flex; align-items: center; justify-content: center;',
    '  font-size: 13px; flex-shrink: 0;',
    '  transition: background 0.15s ease, transform 0.15s ease;',
    '}',
    '.close-btn:hover { background: rgba(255,255,255,0.18); transform: scale(1.08); }',
    '.messages {',
    '  flex: 1; overflow-y: auto; padding: 16px 12px;',
    '  display: flex; flex-direction: column; gap: 10px;',
    '  scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;',
    '}',
    '.msg { display: flex; gap: 8px; align-items: flex-end; }',
    '.msg.user { flex-direction: row-reverse; }',
    '.msg-avatar {',
    '  width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;',
    '  background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.15);',
    '  display: flex; align-items: center; justify-content: center; font-size: 12px;',
    '}',
    '.msg-bubble {',
    '  max-width: 78%; padding: 9px 13px;',
    '  font-size: 13px; line-height: 1.55; color: var(--text);',
    '  border-radius: 16px; word-break: break-word;',
    '  animation: bubbleIn 0.22s cubic-bezier(0.34,1.2,0.64,1) both;',
    '}',
    '@keyframes bubbleIn { from { opacity: 0; transform: scale(0.88) translateY(6px); } to { opacity: 1; transform: none; } }',
    '.msg.ai .msg-bubble { background: var(--ai-bubble); border: 1px solid var(--border); border-bottom-left-radius: 4px; }',
    '.msg.user .msg-bubble { background: var(--user-bubble); border: 1px solid rgba(255,255,255,0.15); border-bottom-right-radius: 4px; }',
    '.input-wrap {',
    '  padding: 12px 12px 16px;',
    '  border-top: 1px solid var(--border);',
    '  display: flex; gap: 8px; align-items: flex-end;',
    '  flex-shrink: 0;',
    '}',
    '.msg-input {',
    '  flex: 1; resize: none; min-height: 38px; max-height: 96px;',
    '  background: var(--bg-input);',
    '  border: 1px solid var(--border);',
    '  border-radius: 12px; padding: 9px 12px;',
    '  font-size: 13px; color: var(--text); font-family: inherit; line-height: 1.45;',
    '  outline: none; transition: border-color 0.18s ease;',
    '}',
    '.msg-input:focus { border-color: rgba(255,255,255,0.35); }',
    '.msg-input::placeholder { color: var(--text-sub); }',
    '.send-btn {',
    '  width: 34px; height: 34px; flex-shrink: 0; border-radius: 50%;',
    '  background: var(--send-bg); color: var(--send-color);',
    '  border: none; cursor: pointer; font-size: 14px;',
    '  display: flex; align-items: center; justify-content: center;',
    '  transition: opacity 0.15s ease, transform 0.15s ease;',
    '}',
    '.send-btn:hover { opacity: 0.85; transform: scale(1.06); }',
  ].join('\n');

  // ========== <webmcp-float> 悬浮 AI 球 ==========

  /**
   * 悬浮 AI 球 Web Component：可拖动，点击展开对话弹窗，iOS 黑白风格。
   * 展开后球锁定至 header 图标位置，不可拖动。
   * @keyword-en float-ball, ai, chat, panel, ios-style
   */
  var WebMcpFloatElement = (function () {
    class WebMcpFloatElement extends HTMLElement {
      connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this._ball = null;
        this._panel = null;
        this._overlay = null;
        this._isOpen = false;
        this._ballX = 0;
        this._ballY = 0;
        this._savedX = 0;
        this._savedY = 0;
        this._isDragging = false;
        this._hasDragged = false;
        this._dragOffsetX = 0;
        this._dragOffsetY = 0;
        this._messages = [];
        this._render();
        this._setupEvents();
        this._positionInitial();
      }

      _render() {
        var PANEL_W = 360;
        var headerIconLeft = 16;   // .panel-header padding-left
        var headerIconCenterX = headerIconLeft + 17; // icon 34px => center offset 17
        var headerIconCenterY = 16 + 17; // padding-top 16 + half 34

        this.shadowRoot.innerHTML = '<style>' + BALL_CSS + '</style>'
          + '<div class="overlay" id="overlay"></div>'
          + '<div class="panel from-right" id="panel">'
          + '  <div class="panel-header">'
          + '    <div class="header-icon" id="header-icon">🤖</div>'
          + '    <div class="header-info"><div class="header-title">AI 助手</div><div class="header-sub">WebMCP</div></div>'
          + '    <button class="close-btn" id="close-btn">✕</button>'
          + '  </div>'
          + '  <div class="messages" id="messages">'
          + '    <div class="msg ai"><div class="msg-bubble">你好！有什么可以帮你的？</div></div>'
          + '  </div>'
          + '  <div class="input-wrap">'
          + '    <textarea class="msg-input" id="msg-input" placeholder="发送消息…" rows="1"></textarea>'
          + '    <button class="send-btn" id="send-btn">↑</button>'
          + '  </div>'
          + '</div>'
          + '<div class="ball" id="ball"><div class="ball-icon">🤖</div></div>';
      }

      _setupEvents() {
        var self = this;
        var sr = this.shadowRoot;
        this._ball    = sr.getElementById('ball');
        this._panel   = sr.getElementById('panel');
        this._overlay = sr.getElementById('overlay');
        var closeBtn  = sr.getElementById('close-btn');
        var sendBtn   = sr.getElementById('send-btn');
        var msgInput  = sr.getElementById('msg-input');

        // 拖动事件
        this._ball.addEventListener('mousedown', function (e) { self._onDown(e.clientX, e.clientY); e.preventDefault(); });
        document.addEventListener('mousemove', function (e) { self._onMove(e.clientX, e.clientY); });
        document.addEventListener('mouseup',   function ()  { self._onUp(); });
        this._ball.addEventListener('touchstart', function (e) {
          var t = e.touches[0]; self._onDown(t.clientX, t.clientY);
        }, { passive: true });
        document.addEventListener('touchmove', function (e) {
          if (!self._ball.dataset.down) return;
          var t = e.touches[0]; self._onMove(t.clientX, t.clientY); e.preventDefault();
        }, { passive: false });
        document.addEventListener('touchend', function () { self._onUp(); });

        // 点击打开
        this._ball.addEventListener('click', function () {
          if (!self._hasDragged) self._togglePanel();
        });

        closeBtn.addEventListener('click', function () { self._closePanel(); });
        this._overlay.addEventListener('click', function () { self._closePanel(); });
        sendBtn.addEventListener('click', function () { self._send(msgInput); });
        msgInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); self._send(msgInput); }
        });
      }

      _positionInitial() {
        this._ballX = window.innerWidth - 64;
        this._ballY = window.innerHeight / 2 - 24;
        this._applyPos();
      }

      _applyPos() {
        this._ball.style.left = this._ballX + 'px';
        this._ball.style.top  = this._ballY + 'px';
      }

      _onDown(cx, cy) {
        if (this._isOpen) return;
        this._dragOffsetX = cx - this._ballX;
        this._dragOffsetY = cy - this._ballY;
        this._ball.style.transition = 'none';
        this._ball.dataset.down = '1';
        this._hasDragged = false;
      }

      _onMove(cx, cy) {
        if (!this._ball.dataset.down) return;
        var dx = cx - this._dragOffsetX - this._ballX;
        var dy = cy - this._dragOffsetY - this._ballY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) this._hasDragged = true;
        if (!this._hasDragged) return;
        this._ballX = cx - this._dragOffsetX;
        this._ballY = cy - this._dragOffsetY;
        this._clamp();
        this._applyPos();
      }

      _onUp() {
        if (!this._ball.dataset.down) return;
        delete this._ball.dataset.down;
        if (this._hasDragged) {
          this._ball.style.transition = '';
          this._snapEdge();
        }
      }

      _clamp() {
        this._ballX = Math.max(6, Math.min(window.innerWidth - 54, this._ballX));
        this._ballY = Math.max(6, Math.min(window.innerHeight - 54, this._ballY));
      }

      _snapEdge() {
        var vw = window.innerWidth;
        this._ball.style.transition = 'left 0.38s cubic-bezier(0.34,1.1,0.64,1)';
        this._ballX = (this._ballX + 24 < vw / 2) ? 8 : vw - 56;
        this._applyPos();
      }

      _togglePanel() {
        if (this._isOpen) this._closePanel(); else this._openPanel();
      }

      _openPanel() {
        var self = this;
        this._isOpen = true;
        this._savedX = this._ballX;
        this._savedY = this._ballY;
        var vw = window.innerWidth;

        // 判断面板方向
        var isRight = (this._ballX + 24 > vw / 2);
        var panelW = Math.min(360, vw * 0.92);

        if (isRight) {
          this._panel.className = 'panel from-right';
        } else {
          this._panel.className = 'panel from-left';
        }

        // 面板入场
        requestAnimationFrame(function () {
          self._panel.classList.add('open');
          self._overlay.classList.add('show');
        });

        // 球移动到 header icon 位置
        // header-icon 在面板内 left: 16px + 17px center = 33px from panel edge, top = 16+17 = 33px
        var targetX, targetY;
        if (isRight) {
          // panel 在右侧：left = vw - panelW
          targetX = vw - panelW + 16;
          targetY = 16;
        } else {
          // panel 在左侧：left = 0
          targetX = 16;
          targetY = 16;
        }

        this._ball.style.transition = 'left 0.42s cubic-bezier(0.34,1.08,0.64,1), top 0.42s cubic-bezier(0.34,1.08,0.64,1), width 0.3s ease, height 0.3s ease, border-radius 0.3s ease, opacity 0.25s ease';
        this._ballX = targetX;
        this._ballY = targetY;
        this._applyPos();

        // 球缩小变成 header icon 大小，并淡出
        this._ball.style.width  = '34px';
        this._ball.style.height = '34px';
        this._ball.style.opacity = '0';
        this._ball.classList.add('locked');
      }

      _closePanel() {
        var self = this;
        this._isOpen = false;
        this._panel.classList.remove('open');
        this._overlay.classList.remove('show');

        // 球还原
        this._ball.style.transition = 'left 0.42s cubic-bezier(0.34,1.08,0.64,1), top 0.42s cubic-bezier(0.34,1.08,0.64,1), width 0.3s ease, height 0.3s ease, border-radius 0.3s ease, opacity 0.28s ease 0.1s';
        this._ball.style.width  = '48px';
        this._ball.style.height = '48px';
        this._ball.style.opacity = '1';
        this._ball.classList.remove('locked');
        this._ballX = this._savedX;
        this._ballY = this._savedY;
        this._applyPos();
      }

      _send(input) {
        var self = this;
        var text = input.value.trim();
        if (!text) return;
        input.value = '';
        input.style.height = '';
        this._addMsg('user', text);
        setTimeout(function () {
          self._addMsg('ai', '我收到了你的消息，正在思考中…');
        }, 700);
      }

      _addMsg(role, text) {
        this._messages.push({ role: role, text: text });
        var box = this.shadowRoot.getElementById('messages');
        var d = document.createElement('div');
        d.className = 'msg ' + role;
        d.innerHTML = '<div class="msg-bubble">' + escapeHtml(text) + '</div>';
        box.appendChild(d);
        box.scrollTop = box.scrollHeight;
      }
    }
    return WebMcpFloatElement;
  })();

  // ========== <webmcp-debug> Debug 面板 ==========

  /**
   * WebMCP Debug 面板 Web Component：iOS 黑白风格，Data/Emit 分 tab，实时读取 handle 值。
   * @keyword-en debug-panel, data-tab, emit-tab, ios-style
   */
  var WebMcpDebugElement = (function () {

    var DEBUG_CSS = '\n' + [
      ':host { position: fixed; z-index: 9998; pointer-events: none; inset: 0; }',
      '*, *::before, *::after { box-sizing: border-box; }',
      ':host { ' + SHARED_CSS + '; }',
      '.ball {',
      '  position: absolute;',
      '  width: 48px; height: 48px; border-radius: 50%;',
      '  background: var(--ball-bg);',
      '  backdrop-filter: blur(20px) saturate(1.8);',
      '  -webkit-backdrop-filter: blur(20px) saturate(1.8);',
      '  border: 1px solid var(--ball-border);',
      '  box-shadow: 0 4px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.15);',
      '  cursor: pointer; pointer-events: auto;',
      '  display: flex; align-items: center; justify-content: center;',
      '  transition: box-shadow 0.2s ease, transform 0.18s ease;',
      '  user-select: none; will-change: transform;',
      '}',
      '.ball:hover { box-shadow: 0 6px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.2); transform: scale(1.04); }',
      '.ball:active { transform: scale(0.96); }',
      '.ball-icon { font-size: 20px; line-height: 1; }',
      '.ball.locked { cursor: default; }',
      '.overlay {',
      '  position: fixed; inset: 0;',
      '  background: rgba(0,0,0,0.5);',
      '  backdrop-filter: blur(2px);',
      '  pointer-events: none; opacity: 0;',
      '  transition: opacity 0.3s cubic-bezier(0.4,0,0.2,1);',
      '}',
      '.overlay.show { opacity: 1; pointer-events: auto; }',
      '.panel {',
      '  position: fixed; top: 0; bottom: 0;',
      '  width: 400px; max-width: 92vw;',
      '  background: var(--bg);',
      '  backdrop-filter: blur(40px) saturate(2);',
      '  -webkit-backdrop-filter: blur(40px) saturate(2);',
      '  border-left: 1px solid var(--border);',
      '  box-shadow: var(--shadow-panel);',
      '  display: flex; flex-direction: column;',
      '  will-change: transform; pointer-events: auto;',
      '  transition: transform 0.46s cubic-bezier(0.34,1.12,0.64,1);',
      '}',
      '.panel.from-right { left: auto; right: 0; transform: translateX(110%); }',
      '.panel.from-left { left: 0; border-left: none; border-right: 1px solid var(--border); transform: translateX(-110%); }',
      '.panel.open { transform: translateX(0) !important; }',
      '.panel-header {',
      '  padding: 16px 16px 0;',
      '  display: flex; align-items: center; gap: 12px;',
      '  flex-shrink: 0;',
      '}',
      '.header-icon {',
      '  width: 34px; height: 34px; border-radius: 50%;',
      '  background: rgba(255,255,255,0.1);',
      '  border: 1px solid rgba(255,255,255,0.15);',
      '  display: flex; align-items: center; justify-content: center;',
      '  font-size: 17px; flex-shrink: 0;',
      '}',
      '.header-title { font-size: 15px; font-weight: 600; color: var(--text); letter-spacing: -0.01em; flex:1; }',
      '.close-btn {',
      '  width: 30px; height: 30px; border-radius: 50%;',
      '  background: rgba(255,255,255,0.1);',
      '  border: none; cursor: pointer; color: var(--text);',
      '  display: flex; align-items: center; justify-content: center;',
      '  font-size: 13px; flex-shrink: 0;',
      '  transition: background 0.15s ease, transform 0.15s ease;',
      '}',
      '.close-btn:hover { background: rgba(255,255,255,0.18); transform: scale(1.08); }',
      '.tabs {',
      '  display: flex; gap: 0; padding: 12px 16px 0;',
      '  flex-shrink: 0;',
      '}',
      '.tab {',
      '  flex: 1; padding: 8px 0; font-size: 12px; font-weight: 600;',
      '  color: var(--text-sub); background: none; border: none; cursor: pointer;',
      '  border-bottom: 2px solid transparent;',
      '  transition: color 0.18s, border-color 0.18s;',
      '  letter-spacing: 0.02em;',
      '}',
      '.tab.active { color: var(--text); border-bottom-color: rgba(255,255,255,0.6); }',
      '.tab-content { flex: 1; overflow-y: auto; padding: 12px 14px 16px; display: none; flex-direction: column; gap: 8px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent; }',
      '.tab-content.active { display: flex; }',
      '.info-bar { padding: 8px 12px; background: rgba(255,255,255,0.05); border-radius: 10px; margin-bottom: 4px; }',
      '.info-bar-label { font-size: 10px; color: var(--text-sub); letter-spacing: 0.06em; text-transform: uppercase; }',
      '.info-bar-val { font-size: 12px; color: var(--text); margin-top: 2px; font-family: "SF Mono", monospace; }',
      '.item {',
      '  background: rgba(255,255,255,0.05);',
      '  border: 1px solid var(--border);',
      '  border-radius: 12px; padding: 10px 12px;',
      '}',
      '.item-head { display: flex; align-items: baseline; gap: 6px; margin-bottom: 3px; }',
      '.item-key { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.55); font-family: "SF Mono", monospace; }',
      '.item-name { font-size: 13px; font-weight: 500; color: var(--text); }',
      '.item-desc { font-size: 11px; color: var(--text-sub); margin-bottom: 6px; }',
      '.item-value { font-size: 11px; color: rgba(255,200,100,0.9); font-family: "SF Mono", monospace; padding: 5px 8px; background: rgba(0,0,0,0.25); border-radius: 6px; margin-bottom: 8px; word-break: break-all; }',
      '.row { display: flex; gap: 6px; }',
      '.txt { flex: 1; background: var(--bg-input); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 6px 10px; font-size: 11px; font-family: "SF Mono", monospace; outline: none; transition: border-color 0.15s; }',
      '.txt:focus { border-color: rgba(255,255,255,0.35); }',
      '.txt::placeholder { color: var(--text-sub); }',
      '.btn { padding: 6px 14px; background: rgba(255,255,255,0.12); color: var(--text); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: background 0.15s; }',
      '.btn:hover { background: rgba(255,255,255,0.2); }',
      '.res { font-size: 11px; margin-top: 5px; padding: 4px 8px; border-radius: 6px; font-family: "SF Mono", monospace; }',
      '.res.ok { color: rgba(100,220,100,0.9); background: rgba(100,220,100,0.08); }',
      '.res.err { color: rgba(255,100,100,0.9); background: rgba(255,100,100,0.08); }',
      '.empty { color: var(--text-sub); font-size: 12px; padding: 20px 0; text-align: center; }',
    ].join('\n');

    class WebMcpDebugElement extends HTMLElement {
      connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this._isOpen = false;
        this._tab = 'data';
        this._savedX = 0;
        this._savedY = 0;
        this._ballX = 0;
        this._ballY = 0;
        this._hasDragged = false;
        this._isDragging = false;
        this._dragOffsetX = 0;
        this._dragOffsetY = 0;
        this._render();
        this._setupEvents();
        this._positionInitial();
      }

      _render() {
        this.shadowRoot.innerHTML = '<style>' + DEBUG_CSS + '</style>'
          + '<div class="overlay" id="overlay"></div>'
          + '<div class="panel from-right" id="panel">'
          + '  <div class="panel-header">'
          + '    <div class="header-icon" id="header-icon">🔧</div>'
          + '    <div class="header-title">WebMCP Debug</div>'
          + '    <button class="close-btn" id="close-btn">✕</button>'
          + '  </div>'
          + '  <div class="tabs">'
          + '    <button class="tab active" id="tab-data">📦 数据变量</button>'
          + '    <button class="tab" id="tab-emit">⚡ 动作事件</button>'
          + '  </div>'
          + '  <div class="tab-content active" id="pane-data"></div>'
          + '  <div class="tab-content" id="pane-emit"></div>'
          + '</div>'
          + '<div class="ball" id="ball"><div class="ball-icon">🔧</div></div>';
      }

      _setupEvents() {
        var self = this;
        var sr = this.shadowRoot;
        this._ball    = sr.getElementById('ball');
        this._panel   = sr.getElementById('panel');
        this._overlay = sr.getElementById('overlay');
        var closeBtn  = sr.getElementById('close-btn');
        var tabData   = sr.getElementById('tab-data');
        var tabEmit   = sr.getElementById('tab-emit');

        // 拖动
        this._ball.addEventListener('mousedown', function (e) { self._onDown(e.clientX, e.clientY); e.preventDefault(); });
        document.addEventListener('mousemove', function (e) { self._onMove(e.clientX, e.clientY); });
        document.addEventListener('mouseup',   function ()  { self._onUp(); });
        this._ball.addEventListener('touchstart', function (e) {
          var t = e.touches[0]; self._onDown(t.clientX, t.clientY);
        }, { passive: true });
        document.addEventListener('touchmove', function (e) {
          if (!self._ball.dataset.down) return;
          var t = e.touches[0]; self._onMove(t.clientX, t.clientY); e.preventDefault();
        }, { passive: false });
        document.addEventListener('touchend', function () { self._onUp(); });

        this._ball.addEventListener('click', function () {
          if (!self._hasDragged) self._togglePanel();
        });

        closeBtn.addEventListener('click', function () { self._closePanel(); });
        this._overlay.addEventListener('click', function () { self._closePanel(); });

        tabData.addEventListener('click', function () { self._switchTab('data'); });
        tabEmit.addEventListener('click', function () { self._switchTab('emit'); });
      }

      _positionInitial() {
        this._ballX = 16;
        this._ballY = window.innerHeight - 72;
        this._applyPos();
      }

      _applyPos() {
        this._ball.style.left = this._ballX + 'px';
        this._ball.style.top  = this._ballY + 'px';
      }

      _onDown(cx, cy) {
        if (this._isOpen) return;
        this._dragOffsetX = cx - this._ballX;
        this._dragOffsetY = cy - this._ballY;
        this._ball.style.transition = 'none';
        this._ball.dataset.down = '1';
        this._hasDragged = false;
      }

      _onMove(cx, cy) {
        if (!this._ball.dataset.down) return;
        var dx = cx - this._dragOffsetX - this._ballX;
        var dy = cy - this._dragOffsetY - this._ballY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) this._hasDragged = true;
        if (!this._hasDragged) return;
        this._ballX = cx - this._dragOffsetX;
        this._ballY = cy - this._dragOffsetY;
        this._clamp();
        this._applyPos();
      }

      _onUp() {
        if (!this._ball.dataset.down) return;
        delete this._ball.dataset.down;
        if (this._hasDragged) {
          this._ball.style.transition = '';
          this._snapEdge();
        }
      }

      _clamp() {
        this._ballX = Math.max(6, Math.min(window.innerWidth - 54, this._ballX));
        this._ballY = Math.max(6, Math.min(window.innerHeight - 54, this._ballY));
      }

      _snapEdge() {
        var vw = window.innerWidth;
        this._ball.style.transition = 'left 0.38s cubic-bezier(0.34,1.1,0.64,1)';
        this._ballX = (this._ballX + 24 < vw / 2) ? 8 : vw - 56;
        this._applyPos();
      }

      _togglePanel() {
        if (this._isOpen) this._closePanel(); else this._openPanel();
      }

      _openPanel() {
        var self = this;
        this._isOpen = true;
        this._savedX = this._ballX;
        this._savedY = this._ballY;
        var vw = window.innerWidth;
        var panelW = Math.min(400, vw * 0.92);

        var isRight = (this._ballX + 24 > vw / 2);
        if (isRight) {
          this._panel.className = 'panel from-right';
        } else {
          this._panel.className = 'panel from-left';
        }

        this._refreshContent();

        requestAnimationFrame(function () {
          self._panel.classList.add('open');
          self._overlay.classList.add('show');
        });

        // 球移动到 header icon 位置并淡出
        var targetX = isRight ? (vw - panelW + 16) : 16;
        var targetY = 16;

        this._ball.style.transition = 'left 0.42s cubic-bezier(0.34,1.08,0.64,1), top 0.42s cubic-bezier(0.34,1.08,0.64,1), width 0.3s ease, height 0.3s ease, opacity 0.25s ease';
        this._ballX = targetX;
        this._ballY = targetY;
        this._applyPos();
        this._ball.style.width = '34px';
        this._ball.style.height = '34px';
        this._ball.style.opacity = '0';
        this._ball.classList.add('locked');
      }

      _closePanel() {
        this._isOpen = false;
        this._panel.classList.remove('open');
        this._overlay.classList.remove('show');

        this._ball.style.transition = 'left 0.42s cubic-bezier(0.34,1.08,0.64,1), top 0.42s cubic-bezier(0.34,1.08,0.64,1), width 0.3s ease, height 0.3s ease, opacity 0.28s ease 0.1s';
        this._ball.style.width = '48px';
        this._ball.style.height = '48px';
        this._ball.style.opacity = '1';
        this._ball.classList.remove('locked');
        this._ballX = this._savedX;
        this._ballY = this._savedY;
        this._applyPos();
      }

      _switchTab(name) {
        this._tab = name;
        var sr = this.shadowRoot;
        sr.getElementById('tab-data').className = 'tab' + (name === 'data' ? ' active' : '');
        sr.getElementById('tab-emit').className = 'tab' + (name === 'emit' ? ' active' : '');
        sr.getElementById('pane-data').className = 'tab-content' + (name === 'data' ? ' active' : '');
        sr.getElementById('pane-emit').className = 'tab-content' + (name === 'emit' ? ' active' : '');
      }

      _refreshContent() {
        var instance = window.__webmcp__;
        var sr = this.shadowRoot;
        var paneData = sr.getElementById('pane-data');
        var paneEmit = sr.getElementById('pane-emit');
        if (!paneData || !paneEmit) return;

        if (!instance) {
          paneData.innerHTML = '<div class="empty">未检测到 WebMCP 实例<br>请先调用 initWebMCP()</div>';
          paneEmit.innerHTML = '<div class="empty">未检测到 WebMCP 实例</div>';
          return;
        }

        var desc = instance.getDescriptor();

        // Info bar
        var info = '<div class="info-bar"><div class="info-bar-label">Page</div><div class="info-bar-val">' + escapeHtml(desc.pageName) + '</div></div>';

        // ---- Data tab ----
        if (desc.data.length === 0) {
          paneData.innerHTML = info + '<div class="empty">暂无 data 变量</div>';
        } else {
          var dataHtml = info + desc.data.map(function (d) {
            var rawVal = typeof d.value === 'function' ? safeCall(d.value) : safeCall(d.handle);
            var val = escapeHtml(JSON.stringify(rawVal));
            var sid = toSafeId(d.key);
            return '<div class="item" data-key="' + escapeHtml(d.key) + '">'
              + '<div class="item-head"><span class="item-key">' + escapeHtml(d.key) + '</span><span class="item-name">' + escapeHtml(d.name) + '</span></div>'
              + '<div class="item-desc">' + escapeHtml(d.desc) + '</div>'
              + '<div class="item-value" id="dv-' + sid + '">' + val + '</div>'
              + '<div class="row">'
              + '<input class="txt" id="di-' + sid + '" placeholder="setdata 值 (JSON)" />'
              + '<button class="btn" data-set="' + escapeHtml(d.key) + '">设置</button>'
              + '<button class="btn" data-refresh="' + escapeHtml(d.key) + '">↻</button>'
              + '</div>'
              + '<div class="res" id="dr-' + sid + '"></div>'
              + '</div>';
          }).join('');
          paneData.innerHTML = dataHtml;
        }

        // ---- Emit tab ----
        if (desc.emits.length === 0) {
          paneEmit.innerHTML = '<div class="empty">暂无 emit 动作</div>';
        } else {
          var emitHtml = desc.emits.map(function (e) {
            var sid = toSafeId(e.key);
            return '<div class="item">'
              + '<div class="item-head"><span class="item-key">' + escapeHtml(e.key) + '</span><span class="item-name">' + escapeHtml(e.name) + '</span></div>'
              + '<div class="item-desc">' + escapeHtml(e.desc) + '</div>'
              + '<div class="row">'
              + '<input class="txt" id="ei-' + sid + '" placeholder="参数 (JSON array, 可留空)" />'
              + '<button class="btn" data-emit="' + escapeHtml(e.key) + '">调用</button>'
              + '</div>'
              + '<div class="res" id="er-' + sid + '"></div>'
              + '</div>';
          }).join('');
          paneEmit.innerHTML = emitHtml;
        }

        // 绑定事件（每次刷新重新绑定，不累积）
        this._bindDataEvents(paneData, desc, instance);
        this._bindEmitEvents(paneEmit, desc, instance);
      }

      _bindDataEvents(pane, desc, instance) {
        var self = this;
        pane.addEventListener('click', function (e) {
          var target = e.target;
          var setKey = target.getAttribute('data-set');
          var refreshKey = target.getAttribute('data-refresh');

          if (setKey) {
            var input = pane.querySelector('#di-' + toSafeId(setKey));
            var res   = pane.querySelector('#dr-' + toSafeId(setKey));
            var parsed = safeJsonParse(input ? input.value : '');
            var result = instance.setDataValue(setKey, parsed);
            if (res) {
              res.className = 'res ' + (result.ok ? 'ok' : 'err');
              res.textContent = result.ok ? '✓ 已设置' : '✗ ' + result.error;
            }
          }

          if (refreshKey) {
            var valEl = pane.querySelector('#dv-' + toSafeId(refreshKey));
            if (!valEl) return;
            var entry = desc.data.find(function (d) { return d.key === refreshKey; });
            if (entry) {
              var rv = typeof entry.value === 'function' ? safeCall(entry.value) : safeCall(entry.handle);
              valEl.textContent = JSON.stringify(rv);
            }
          }
        });
      }

      _bindEmitEvents(pane, desc, instance) {
        pane.addEventListener('click', function (e) {
          var target = e.target;
          var emitKey = target.getAttribute('data-emit');
          if (!emitKey) return;

          var input = pane.querySelector('#ei-' + toSafeId(emitKey));
          var res   = pane.querySelector('#er-' + toSafeId(emitKey));
          var raw   = input ? input.value.trim() : '';
          var parsed = safeJsonParse(raw);
          var args = Array.isArray(parsed) ? parsed : (parsed !== undefined && raw !== '' ? [parsed] : []);

          // 从实例实时拿最新 descriptor，确保 handle 是最新绑定
          var currentDesc = instance.getDescriptor();
          var entry = currentDesc.emits.find(function (x) { return x.key === emitKey; });
          if (!entry) {
            if (res) { res.className = 'res err'; res.textContent = '✗ 找不到 ' + emitKey; }
            return;
          }

          if (res) { res.className = 'res'; res.textContent = '调用中…'; }

          Promise.resolve()
            .then(function () { return entry.handle.apply(null, args); })
            .then(function (ret) {
              if (res) {
                res.className = 'res ok';
                res.textContent = '✓ 成功' + (ret !== undefined ? ' → ' + JSON.stringify(ret) : '');
              }
            })
            .catch(function (err) {
              if (res) { res.className = 'res err'; res.textContent = '✗ ' + String(err); }
            });
        });
      }
    }
    return WebMcpDebugElement;
  })();

  // ========== 注册 Web Components ==========

  /**
   * 注册所有 WebMCP Web Components（悬浮球 + Debug 面板）
   * @keyword-en register-web-components
   */
  function registerWebMCPComponents() {
    if (!customElements.get('webmcp-float')) {
      customElements.define('webmcp-float', WebMcpFloatElement);
    }
    if (!customElements.get('webmcp-debug')) {
      customElements.define('webmcp-debug', WebMcpDebugElement);
    }
  }

  return {
    initWebMCP: initWebMCP,
    registerWebMCPComponents: registerWebMCPComponents,
  };
});
