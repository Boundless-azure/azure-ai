import type { UnitCoreModule } from '../../types/unit.types';
import * as terminalOps from './unit-core/terminal.ops';

/**
 * @title 终端操作能力 Hook 映射
 * @description 将 terminal 能力的 Hook 名称映射到具体实现。
 * @keywords-cn Hook映射, 终端能力, UnitCore
 * @keywords-en hook-mapping, terminal-ops, unit-core
 */
export const unitCore: UnitCoreModule['handlers'] = {
  'runner.unitcore.terminal.exec': async (ctx, payload) =>
    terminalOps.exec(ctx, payload as import('./unit-core/terminal.types').TerminalExecPayload),
  'runner.unitcore.terminal.getStatus': async (ctx, payload) =>
    terminalOps.getStatus(ctx, payload as import('./unit-core/terminal.types').TerminalHandlePayload),
  'runner.unitcore.terminal.getOutput': async (ctx, payload) =>
    terminalOps.getOutput(ctx, payload as import('./unit-core/terminal.types').TerminalHandlePayload),
  'runner.unitcore.terminal.kill': async (ctx, payload) =>
    terminalOps.kill(ctx, payload as import('./unit-core/terminal.types').TerminalHandlePayload),
  'runner.unitcore.terminal.getPoolStatus': async (ctx) =>
    terminalOps.getPoolStatus(ctx),
};

export default unitCore;
