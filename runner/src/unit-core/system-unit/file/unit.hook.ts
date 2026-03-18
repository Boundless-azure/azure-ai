import { z } from 'zod';
import type { UnitHookModule } from '../../types/unit.types';

/**
 * @title 文件操作能力 Hook 描述
 * @description 仅声明 Hook 能力与 payload 校验，默认限制 workspace 目录。
 * @keywords-cn 文件操作, Hook描述, workspace限制
 * @keywords-en file-ops, hook-descriptor, workspace-restriction
 */
export const unitHooks: UnitHookModule = {
  unit: {
    name: 'file',
    description: '提供工作区文件/目录的增删改查与局部修改能力',
    keywordsCn: ['文件', '目录', '读写', '修改'],
    keywordsEn: ['file', 'directory', 'read', 'write', 'patch'],
  },
  hooks: [
    {
      name: 'file:read',
      description: '读取 workspace 下指定文件内容',
      payloadSchema: z.object({ path: z.string() }),
    },
    {
      name: 'file:write',
      description: '写入 workspace 下指定文件（覆盖）',
      payloadSchema: z.object({ path: z.string(), content: z.string() }),
    },
    {
      name: 'file:delete',
      description: '删除 workspace 下指定文件',
      payloadSchema: z.object({ path: z.string() }),
    },
    {
      name: 'file:list',
      description: '列出 workspace 下指定目录内容',
      payloadSchema: z.object({ path: z.string() }),
    },
    {
      name: 'file:patchRange',
      description: '对 workspace 文件执行按行/字符区间的局部修改',
      payloadSchema: z.object({
        path: z.string(),
        startLine: z.number().int().nonnegative().optional(),
        endLine: z.number().int().positive().optional(),
        startChar: z.number().int().nonnegative().optional(),
        endChar: z.number().int().positive().optional(),
        content: z.string(),
      }),
    },
  ],
};

export default unitHooks;
