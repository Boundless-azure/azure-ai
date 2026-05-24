import type { UnitCoreModule } from '../../types/unit.types';
import { astOps } from './unit-core/ast.ops';

/**
 * @title AST 能力 Hook 映射
 * @description 将 AST 分析 hook 映射到具体实现。
 * @keywords-cn Hook映射, AST分析, UnitCore
 * @keywords-en hook-mapping, ast-analysis, unit-core
 */
export const unitCore: UnitCoreModule['handlers'] = {
  'runner.unitcore.ast.analyze': async (ctx, payload) => astOps.analyze(ctx, payload as { path: string }),
};

export default unitCore;
