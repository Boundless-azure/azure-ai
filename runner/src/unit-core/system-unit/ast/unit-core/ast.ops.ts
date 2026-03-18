import ts from 'typescript';
import type { UnitExecutionContext } from '../../../types/unit.types';

/**
 * @title AST 分析能力实现
 * @description 使用 TypeScript AST 分析 JS/TS/JSX/MJS/CJS 文件函数位置与 JSDOC 描述。
 * @keywords-cn AST实现, JS分析, 函数定位, JSDOC
 * @keywords-en ast-ops, js-analysis, function-location, jsdoc
 */
export const astOps = {
  /**
   * @title 分析文件
   * @description 读取 JS/TS/JSX/MJS/CJS 文件并返回函数列表与 JSDOC 描述。
   * @keywords-cn 文件分析, JS分析, 函数列表, JSDOC描述
   * @keywords-en analyze-file, js-analysis, function-list, jsdoc
   */
  async analyze(ctx: UnitExecutionContext, payload: { path: string }) {
    const result = await ctx.invokeHook<{ path: string }, { content: string }>('file:read', {
      path: payload.path,
    });
    const content = result.content;
    const kind = resolveScriptKind(payload.path);
    const sourceFile = ts.createSourceFile(
      payload.path,
      content,
      ts.ScriptTarget.Latest,
      true,
      kind,
    );
    const functions: Array<{
      name: string;
      kind: string;
      startLine: number;
      endLine: number;
      jsdoc?: string;
    }> = [];

    const visit = (node: ts.Node) => {
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node)
      ) {
        const name =
          (node as ts.FunctionDeclaration).name?.getText(sourceFile) ??
          (ts.isMethodDeclaration(node) ? node.name.getText(sourceFile) : 'anonymous');
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        const jsDocText = extractJsDoc(node);
        functions.push({
          name,
          kind: ts.SyntaxKind[node.kind],
          startLine: start.line + 1,
          endLine: end.line + 1,
          jsdoc: jsDocText ?? undefined,
        });
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return { path: payload.path, kind: ts.ScriptKind[kind], functions };
  },
};

function resolveScriptKind(filePath: string): ts.ScriptKind {
  const lowered = filePath.toLowerCase();
  if (lowered.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (lowered.endsWith('.ts')) return ts.ScriptKind.TS;
  if (lowered.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (lowered.endsWith('.mjs')) return ts.ScriptKind.JS;
  if (lowered.endsWith('.cjs')) return ts.ScriptKind.JS;
  return ts.ScriptKind.JS;
}

function extractJsDoc(node: ts.Node): string | null {
  const jsDocs = ts
    .getJSDocCommentsAndTags(node)
    .filter((item): item is ts.JSDoc => ts.isJSDoc(item));
  if (jsDocs.length === 0) return null;
  const descriptions = jsDocs
    .map((doc: ts.JSDoc) => (typeof doc.comment === 'string' ? doc.comment : ''))
    .filter((item: string) => item.trim().length > 0);
  if (descriptions.length === 0) return null;
  return descriptions.join('\n');
}
