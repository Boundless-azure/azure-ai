import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { UnitCoreHandler, UnitCoreModule, UnitHookModule, UnitSource } from '../types/unit.types';

/**
 * @title Unit 加载器
 * @description 动态加载 unit.hook 与 unit.core 模块，支持热更新。
 * @keywords-cn Unit加载, 动态导入, 热更新
 * @keywords-en unit-loader, dynamic-import, hot-reload
 */
export class UnitLoaderService {
  /**
   * @title 加载 Hook 模块
   * @description 读取 unit.hook 文件并提取 hook 描述结构。
   * @keywords-cn Hook模块, 读取, unit.hook
   * @keywords-en hook-module, load, unit.hook
   */
  async loadHookModule(source: UnitSource): Promise<UnitHookModule | null> {
    if (!existsSync(source.hookFilePath)) return null;
    const mod = await this.loadModule(source.hookFilePath);
    const hooks = (mod?.unitHooks ?? mod?.default ?? mod) as UnitHookModule | undefined;
    if (!hooks?.unit || !hooks?.hooks) return null;
    return hooks;
  }

  /**
   * @title 加载 Core 模块
   * @description 读取 unit.core 文件并提取 hook 到 handler 的映射。
   * @keywords-cn Core模块, handler映射, unit.core
   * @keywords-en core-module, handler-map, unit.core
   */
  async loadCoreModule(
    source: UnitSource,
    options?: { hot?: boolean },
  ): Promise<UnitCoreModule | null> {
    if (!source.coreFilePath || !existsSync(source.coreFilePath)) return null;
    if (options?.hot) {
      this.clearModuleCache(source.coreFilePath);
    }
    const mod = await this.loadModule(source.coreFilePath);
    const core = (mod?.unitCore ?? mod?.default ?? mod) as
      | Record<string, UnitCoreHandler>
      | undefined;
    if (!core) return null;
    return { unitName: source.unitName, handlers: core };
  }

  private async loadModule(filePath: string): Promise<Record<string, unknown> | null> {
    try {
      return require(filePath) as Record<string, unknown>;
    } catch {
      try {
        const url = pathToFileURL(filePath).toString();
        return (await import(url)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }

  private clearModuleCache(filePath: string): void {
    const resolved = require.resolve(filePath);
    delete require.cache[resolved];
  }
}
