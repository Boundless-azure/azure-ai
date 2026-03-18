import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import type { UnitSource } from '../types/unit.types';

/**
 * @title Unit 注册器
 * @description 扫描 workspace 与 system-unit 目录，定位 unit 文件结构。
 * @keywords-cn Unit注册器, 目录扫描, Hook文件
 * @keywords-en unit-registry, directory-scan, hook-files
 */
export class UnitRegistryService {
  constructor(
    private readonly workspacePath: string,
    private readonly systemUnitPath: string,
  ) {}

  /**
   * @title 扫描所有 Unit
   * @description 读取 workspace/unit 与 system-unit 下的 unit 描述。
   * @keywords-cn 扫描Unit, workspace, system-unit
   * @keywords-en scan-units, workspace, system-unit
   */
  scanUnits(): UnitSource[] {
    const sources: UnitSource[] = [];
    sources.push(...this.scanUnitDir(join(this.workspacePath, 'unit'), 'workspace'));
    sources.push(...this.scanUnitDir(this.systemUnitPath, 'system'));
    return sources;
  }

  private scanUnitDir(dirPath: string, source: 'workspace' | 'system'): UnitSource[] {
    if (!existsSync(dirPath)) return [];
    const list = readdirSync(dirPath);
    const items: UnitSource[] = [];
    for (const entry of list) {
      const fullPath = join(dirPath, entry);
      if (!statSync(fullPath).isDirectory()) continue;
      const hookFile = this.pickUnitFile(fullPath, 'unit.hook');
      if (!hookFile) continue;
      const coreFile = this.pickUnitFile(fullPath, 'unit.core');
      const descFile = this.pickUnitFile(fullPath, 'unit.desc');
      items.push({
        unitName: entry,
        unitPath: fullPath,
        hookFilePath: hookFile,
        coreFilePath: coreFile,
        descFilePath: descFile,
        source,
      });
    }
    return items;
  }

  private pickUnitFile(unitDir: string, basename: string): string | null {
    const candidates = readdirSync(unitDir).filter((file) => file.startsWith(basename));
    for (const file of candidates) {
      const ext = extname(file).toLowerCase();
      if (ext === '.ts' || ext === '.js' || ext === '.mjs' || ext === '.cjs') {
        return join(unitDir, file);
      }
    }
    return null;
  }
}
