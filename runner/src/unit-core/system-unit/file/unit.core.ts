import type { UnitCoreModule } from '../../types/unit.types';
import { fileOps } from './unit-core/file.ops';

/**
 * @title 文件操作能力 Hook 映射
 * @description 将 file 能力的 Hook 名称映射到具体实现。
 * @keywords-cn Hook映射, 文件能力, UnitCore
 * @keywords-en hook-mapping, file-ops, unit-core
 */
export const unitCore: UnitCoreModule['handlers'] = {
  'runner.unitcore.file.read': async (ctx, payload) => fileOps.readFile(ctx, payload as { path: string }),
  'runner.unitcore.file.write': async (ctx, payload) =>
    fileOps.writeFile(ctx, payload as { path: string; content: string }),
  'runner.unitcore.file.delete': async (ctx, payload) => fileOps.deleteFile(ctx, payload as { path: string }),
  'runner.unitcore.file.list': async (ctx, payload) => fileOps.listDir(ctx, payload as { path: string }),
  'runner.unitcore.file.patchRange': async (ctx, payload) =>
    fileOps.patchRange(
      ctx,
      payload as {
        path: string;
        startLine?: number;
        endLine?: number;
        startChar?: number;
        endChar?: number;
        content: string;
      },
    ),
};

export default unitCore;
