import { Injectable } from '@nestjs/common';
import type { HookComponentMeta } from '../decorators/hook-component.decorator';

/**
 * SaaS 侧单条 hook 组件的完整记录。
 * @keyword-en hook-component-entry
 */
export interface HookComponentEntry {
  js: string;
  description?: string;
  tags: string[];
  /** zod schema 转出的 JSON Schema，暴露给 LLM get_hook_info */
  payloadSchemaJson?: unknown;
}

/**
 * @title Hook Component Registry Service
 * @description SaaS 侧 Hook 组件注册表。存储 hookName → {js, description, tags, payloadSchemaJson} 映射，
 *              供 HookComponentController 在广播 Runner 之前优先查询。
 *              组件 JS 须符合 ESM 格式，导出 render(container, payload) 函数。
 * @keywords-cn hook组件注册表, SaaS组件, 预定义组件, 元数据
 * @keywords-en hook-component-registry, saas-component, predefined-component, component-metadata
 */
@Injectable()
export class HookComponentRegistryService {
  private readonly store = new Map<string, HookComponentEntry>();

  /**
   * 注册一个 SaaS 侧 hook 组件。
   * @param hookName hook 地址，如 saas.app.todo.card
   * @param js ESM JS 字符串，须导出 render(container, payload)
   * @param meta 描述/标签/schema（来自 @HookComponent 第二参数）
   * @keyword-en register-hook-component
   */
  register(hookName: string, js: string, meta?: HookComponentMeta): void {
    let payloadSchemaJson: unknown;
    if (meta?.payloadSchema) {
      try {
        // zodToJsonSchema 是可选依赖；若不存在则跳过 schema 投影
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { zodToJsonSchema } = require('zod-to-json-schema') as {
          zodToJsonSchema: (s: unknown) => unknown;
        };
        payloadSchemaJson = zodToJsonSchema(meta.payloadSchema);
      } catch {
        // zod-to-json-schema 未安装时静默跳过
      }
    }
    this.store.set(hookName, {
      js,
      description: meta?.description,
      tags: meta?.tags ?? [],
      payloadSchemaJson,
    });
  }

  /**
   * 查询指定 hookName 的组件 JS，不存在返回 null。
   * @keyword-en get-hook-component-js
   */
  get(hookName: string): string | null {
    return this.store.get(hookName)?.js ?? null;
  }

  /**
   * 查询指定 hookName 的完整元数据（含 js），不存在返回 null。
   * @keyword-en get-hook-component-metadata
   */
  getEntry(hookName: string): HookComponentEntry | null {
    return this.store.get(hookName) ?? null;
  }

  /**
   * 列出所有已注册的组件 hookName 列表。
   * @keyword-en list-hook-component-names
   */
  list(): string[] {
    return Array.from(this.store.keys());
  }
}
