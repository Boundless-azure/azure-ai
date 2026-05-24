模块名称：runner/unit-core/system-unit/ast（系统 AST 分析能力）

关键词索引（中文 / English Keyword Index）
AST能力Hook -> unit-core/system-unit/ast/unit.hook.ts
AST能力描述 -> unit-core/system-unit/ast/unit.desc.ts
AST能力映射 -> unit-core/system-unit/ast/unit.core.ts
AST能力实现 -> unit-core/system-unit/ast/unit-core/ast.ops.ts
ast-unit-hook -> unit-core/system-unit/ast/unit.hook.ts
ast-unit-core -> unit-core/system-unit/ast/unit.core.ts
ast-unit-ops -> unit-core/system-unit/ast/unit-core/ast.ops.ts

关键词到函数哈希映射（Keywords -> Function Hash）
- astOps.analyze -> unit_ast_analyze_001

模块功能描述（Description）
系统 AST 能力基于 TypeScript AST 解析 JS/TS 文件，输出函数位置与 JSDOC 描述信息，并通过 runner.unitcore.file.read Hook 获取文件内容。
