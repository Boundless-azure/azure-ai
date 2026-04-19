模块名称：runner/unit-core/system-unit/file（系统文件操作能力）

关键词索引（中文 / English Keyword Index）
文件能力Hook -> unit-core/system-unit/file/unit.hook.ts
文件能力描述 -> unit-core/system-unit/file/unit.desc.ts
文件能力映射 -> unit-core/system-unit/file/unit.core.ts
文件能力实现 -> unit-core/system-unit/file/unit-core/file.ops.ts
file-unit-hook -> unit-core/system-unit/file/unit.hook.ts
file-unit-core -> unit-core/system-unit/file/unit.core.ts
file-unit-ops -> unit-core/system-unit/file/unit-core/file.ops.ts

关键词到函数哈希映射（Keywords -> Function Hash）
- fileOps.readFile -> unit_file_read_001
- fileOps.writeFile -> unit_file_write_002
- fileOps.deleteFile -> unit_file_delete_003
- fileOps.listDir -> unit_file_list_004
- fileOps.patchRange -> unit_file_patch_005

模块功能描述（Description）
系统文件操作能力用于在 workspace 目录内安全执行文件与目录读写，并提供行/字符区间的局部修改能力。
