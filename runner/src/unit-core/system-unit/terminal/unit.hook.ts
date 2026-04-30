import { z } from 'zod';
import type { UnitHookModule } from '../../types/unit.types';

/**
 * @title 终端操作能力 Hook 描述
 * @description 声明终端命令执行相关 hook, 支持同步/异步模式与进程池管理。
 * @keywords-cn 终端操作, Hook描述, 命令执行
 * @keywords-en terminal-ops, hook-descriptor, command-exec
 */
export const unitHooks: UnitHookModule = {
  unit: {
    name: 'terminal',
    description: '提供终端命令执行能力, 支持同步/异步模式, 进程池管理(上限8)',
    keywordsCn: ['终端', '命令', '执行', 'shell', '进程池'],
    keywordsEn: ['terminal', 'command', 'shell', 'exec', 'process-pool'],
  },
  hooks: [
    {
      name: 'runner.unitcore.terminal.exec',
      description:
        '执行终端命令。mode=sync 同步等待结果(≤30s超时转async); mode=async 异步返回handleId, 完成后自动通知对话',
      payloadSchema: z.object({
        command: z.string().describe('要执行的命令'),
        sessionId: z.string().describe('用于回调通知的会话 ID'),
        mode: z.enum(['sync', 'async']).optional().describe('执行模式, 默认 sync'),
        timeout: z.number().optional().describe('超时 ms'),
        maxBuffer: z.number().optional().describe('输出缓冲上限 bytes'),
      }),
    },
    {
      name: 'runner.unitcore.terminal.getStatus',
      description: '查询异步命令执行状态',
      payloadSchema: z.object({
        handleId: z.string().describe('执行句柄 ID'),
      }),
    },
    {
      name: 'runner.unitcore.terminal.getOutput',
      description: '获取异步命令完整执行记录(stdout+stderr+exitCode)',
      payloadSchema: z.object({
        handleId: z.string().describe('执行句柄 ID'),
      }),
    },
    {
      name: 'runner.unitcore.terminal.kill',
      description: '终止运行中的异步命令',
      payloadSchema: z.object({
        handleId: z.string().describe('执行句柄 ID'),
      }),
    },
    {
      name: 'runner.unitcore.terminal.getPoolStatus',
      description: '查看终端进程池状态(活跃数/上限/可用数)',
      payloadSchema: z.object({}),
    },
  ],
};

export default unitHooks;
