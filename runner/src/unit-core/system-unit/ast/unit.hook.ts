import { z } from 'zod';
import type { UnitHookModule } from '../../types/unit.types';

/**
 * @title AST 分析能力 Hook 描述
 * @description 基于 TypeScript AST 分析 JS/TS/JSX/MJS/CJS 文件结构。
 * @keywords-cn AST分析, JS分析, 函数定位, JSDOC提取
 * @keywords-en ast-analysis, js-analysis, function-locate, jsdoc-extract
 */
export const unitHooks: UnitHookModule = {
  unit: {
    name: 'ast',
    description: '分析 JS/TS/JSX/MJS/CJS 文件的函数与 JSDOC 描述节点',
    keywordsCn: ['AST', '函数', 'JSDOC'],
    keywordsEn: ['ast', 'function', 'jsdoc'],
  },
  hooks: [
    {
      name: 'ast:analyze',
      description: '解析 JS/TS/JSX/MJS/CJS 文件，返回函数位置与 JSDOC 描述',
      payloadSchema: z.object({ path: z.string() }),
    },
  ],
};

export default unitHooks;
