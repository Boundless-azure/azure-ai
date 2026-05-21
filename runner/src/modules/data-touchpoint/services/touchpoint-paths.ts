import { realpathSync } from 'node:fs';
import { isAbsolute, resolve, sep } from 'node:path';

/**
 * @title 触点文件路径解析与防护
 * @description 解析触点的相对路径并校验未逃出 rootDir; 拒绝绝对路径 / null byte / `..` 逃逸 / symlink 逃逸。
 *              loader 在动态 import 胶水代码与读取 config 前一律走这一层, 避免 AI 通过 create hook 让 runner import 任意 .js。
 * @keywords-cn 触点路径, 路径防护, 路径校验, 沙箱根, 防止越权
 * @keywords-en touchpoint-paths, path-guard, path-traversal, sandbox-root, escape-prevent
 */

/**
 * 路径被拒原因 (绝对路径 / null byte / 逃出 root)
 * @keyword-en touchpoint-path-denied-error
 */
export class TouchpointPathDeniedError extends Error {
  constructor(
    public readonly relPath: string,
    public readonly reason: string,
  ) {
    super(`touchpoint path denied: ${reason} (${relPath})`);
    this.name = 'TouchpointPathDeniedError';
  }
}

/**
 * 解析触点文件路径并校验未逃出 root。
 *  - 拒绝绝对路径 (Unix `/`, Windows 盘符, UNC `\\?\` / `\\server`)
 *  - 拒绝含 null byte 的路径
 *  - rootDir 必须存在 (realpath 解析失败会抛 ENOENT, 调用方应保证)
 *  - 目标文件可不存在 (loader 后续 readFile 自然报 ENOENT); 存在则 realpath 解 symlink 二次校验, 确保解开后仍在 root 下
 * @keyword-en resolve-touchpoint-file
 */
export function resolveTouchpointFile(
  rootDir: string,
  relPath: string,
): string {
  if (typeof relPath !== 'string' || relPath.length === 0) {
    throw new TouchpointPathDeniedError(String(relPath), 'empty path');
  }
  if (relPath.includes('\0')) {
    throw new TouchpointPathDeniedError(relPath, 'null byte');
  }
  if (
    isAbsolute(relPath) ||
    /^[a-zA-Z]:[\\/]/.test(relPath) ||
    relPath.startsWith('\\\\')
  ) {
    throw new TouchpointPathDeniedError(relPath, 'absolute path forbidden');
  }

  const realRoot = realpathSync(rootDir);
  const resolved = resolve(realRoot, relPath);
  // 目标文件可能不存在 (loader 后续会抛 ENOENT); 存在则解 symlink 二次校验
  let realFile = resolved;
  try {
    realFile = realpathSync(resolved);
  } catch {
    // 文件不存在: 用 resolved (已 normalize) 做字符串校验
  }
  if (realFile !== realRoot && !realFile.startsWith(realRoot + sep)) {
    throw new TouchpointPathDeniedError(
      relPath,
      `escapes root: ${realFile} not under ${realRoot}`,
    );
  }
  return realFile;
}
