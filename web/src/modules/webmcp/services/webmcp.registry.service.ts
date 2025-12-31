/**
 * @title WebMCP Registry Service
 * @description Manages page declarations, hook registries, and wire conversion.
 * @keywords-cn WebMCP注册表, 页面声明, 指针转换
 * @keywords-en webmcp-registry, page-declaration, pointer-conversion
 */
import type {
  WebMcpHookItem,
  WebMcpPageDeclaration,
  WebMcpWirePageDeclaration,
  WebMcpOperation,
} from '../types/webmcp.types';

export type WebMcpListener = (evt: {
  type: 'beforeHook' | 'afterHook' | 'beforeVarChange' | 'afterVarChange';
  pointer?: string;
  page?: string;
  keyword?: string[];
  value?: unknown;
}) => void | Promise<void>;

export class WebMcpRegistryService {
  private page?: WebMcpPageDeclaration;
  private hookMap = new Map<string, WebMcpHookItem>();
  private listeners: WebMcpListener[] = [];

  /**
   * @title 注册页面
   * @description 注册页面声明并构建指针映射
   * @keywords-cn 注册页面
   * @keywords-en register-page
   */
  registerPage(decl: WebMcpPageDeclaration) {
    this.page = decl;
    this.hookMap.clear();
    this.indexHooks(decl);
  }

  on(listener: WebMcpListener) {
    this.listeners.push(listener);
  }

  private async notify(evt: Parameters<WebMcpListener>[0]) {
    for (const l of this.listeners) await l(evt);
  }

  private indexHooks(decl: WebMcpPageDeclaration) {
    const pageId = decl.page;
    const hooks = decl.hook ?? [];
    for (const h of hooks) {
      const pointer = this.buildPointer(pageId, h.hookname);
      this.hookMap.set(pointer, h);
    }
    const children = decl.childPage ?? [];
    for (const c of children) this.indexHooks(c);
  }

  private buildPointer(page: string, hookname: string) {
    return `${page}::${hookname}`;
  }

  toWire(decl?: WebMcpPageDeclaration): WebMcpWirePageDeclaration | null {
    const d = decl ?? this.page;
    if (!d) return null;
    return {
      page: d.page,
      desc: d.desc,
      keyword: d.keyword,
      data: d.data?.slice() ?? [],
      hook: (d.hook ?? []).map((h) => ({
        hookname: h.hookname,
        keyword: h.keyword,
        pointer: this.buildPointer(d.page, h.hookname),
        desc: h.desc,
      })),
      childPage: (d.childPage ?? []).map((c) => this.toWire(c)).filter(Boolean),
    };
  }

  /**
   * @title 执行操作
   * @description 执行来自后端的操作 JSON
   * @keywords-cn 执行操作
   * @keywords-en execute-operation
   */
  async execute(op: WebMcpOperation): Promise<{ ok: boolean; error?: string }> {
    if (op.op === 'callHook') {
      const h = this.hookMap.get(op.pointer);
      if (!h) return { ok: false, error: 'hook-not-found' };
      await this.notify({ type: 'beforeHook', pointer: op.pointer });
      try {
        await Promise.resolve(h.action());
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      await this.notify({ type: 'afterHook', pointer: op.pointer });
      return { ok: true };
    }
    if (op.op === 'setData') {
      await this.notify({
        type: 'beforeVarChange',
        page: op.page,
        keyword: op.keyword,
        value: op.value,
      });
      await this.notify({
        type: 'afterVarChange',
        page: op.page,
        keyword: op.keyword,
        value: op.value,
      });
      return { ok: true };
    }
    return { ok: false, error: 'unsupported-op' };
  }
}
