import { mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import type { UnitExecutionContext } from '../../../types/unit.types';

/**
 * @title 文件操作能力实现
 * @description 提供受 workspace 限制的文件与目录读写操作。
 * @keywords-cn 文件操作, workspace限制, 目录读写
 * @keywords-en file-ops, workspace-restriction, directory-io
 */
export const fileOps = {
  /**
   * @title 读取文件
   * @description 读取 workspace 下指定文件内容。
   * @keywords-cn 读取文件, workspace, 文件内容
   * @keywords-en read-file, workspace, file-content
   */
  readFile(ctx: UnitExecutionContext, payload: { path: string }) {
    const target = ensureWorkspacePath(ctx.workspacePath, payload.path);
    const content = readFileSync(target, 'utf8');
    return { path: payload.path, content };
  },

  /**
   * @title 写入文件
   * @description 覆盖写入 workspace 下指定文件内容。
   * @keywords-cn 写入文件, 覆盖写入, workspace
   * @keywords-en write-file, overwrite, workspace
   */
  writeFile(ctx: UnitExecutionContext, payload: { path: string; content: string }) {
    const target = ensureWorkspacePath(ctx.workspacePath, payload.path);
    const dir = resolve(target, '..');
    mkdirSync(dir, { recursive: true });
    writeFileSync(target, payload.content, 'utf8');
    return { path: payload.path, ok: true };
  },

  /**
   * @title 删除文件
   * @description 删除 workspace 下指定文件。
   * @keywords-cn 删除文件, workspace, 文件移除
   * @keywords-en delete-file, workspace, remove
   */
  deleteFile(ctx: UnitExecutionContext, payload: { path: string }) {
    const target = ensureWorkspacePath(ctx.workspacePath, payload.path);
    unlinkSync(target);
    return { path: payload.path, ok: true };
  },

  /**
   * @title 目录列表
   * @description 列出 workspace 目录下的文件与子目录。
   * @keywords-cn 目录列表, workspace, 文件目录
   * @keywords-en list-directory, workspace, file-list
   */
  listDir(ctx: UnitExecutionContext, payload: { path: string }) {
    const target = ensureWorkspacePath(ctx.workspacePath, payload.path);
    const entries = readdirSync(target).map((name) => {
      const full = join(target, name);
      const stat = statSync(full);
      return { name, path: join(payload.path, name), isDir: stat.isDirectory() };
    });
    return { path: payload.path, entries };
  },

  /**
   * @title 文件区间修改
   * @description 支持按行或字符区间替换内容。
   * @keywords-cn 局部修改, 行区间, 字符区间
   * @keywords-en partial-update, line-range, char-range
   */
  patchRange(
    ctx: UnitExecutionContext,
    payload: {
      path: string;
      startLine?: number;
      endLine?: number;
      startChar?: number;
      endChar?: number;
      content: string;
    },
  ) {
    const target = ensureWorkspacePath(ctx.workspacePath, payload.path);
    const original = readFileSync(target, 'utf8');
    let next = original;
    if (payload.startLine !== undefined && payload.endLine !== undefined) {
      const lines = original.split(/\r?\n/);
      const start = Math.max(0, payload.startLine - 1);
      const end = Math.min(lines.length, payload.endLine);
      const before = lines.slice(0, start);
      const after = lines.slice(end);
      const middle = payload.content.split(/\r?\n/);
      next = [...before, ...middle, ...after].join('\n');
    } else if (payload.startChar !== undefined && payload.endChar !== undefined) {
      const start = Math.max(0, payload.startChar - 1);
      const end = Math.min(original.length, payload.endChar);
      next = `${original.slice(0, start)}${payload.content}${original.slice(end)}`;
    } else {
      throw new Error('invalid patch range');
    }
    writeFileSync(target, next, 'utf8');
    return { path: payload.path, ok: true };
  },
};

function ensureWorkspacePath(workspaceRoot: string, relativePath: string): string {
  const normalized = relativePath.replace(/^([/\\])+/, '');
  const target = resolve(workspaceRoot, normalized);
  const root = resolve(workspaceRoot);
  if (!target.startsWith(root + sep) && target !== root) {
    throw new Error('path is outside workspace');
  }
  return target;
}
