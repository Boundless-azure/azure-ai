import { $ } from 'zx';

/**
 * @title Runner 任务执行器
 * @description 基于 zx 执行本地命令，供后续 AI 派发任务扩展。
 * @keywords-cn zx执行器, 命令执行, 任务派发
 * @keywords-en zx-runner, command-execution, task-dispatch
 */
export class RunnerTaskExecutor {
  async run(command: string): Promise<{ ok: boolean; stdout: string; stderr: string }> {
    try {
      const result = await $`${command}`;
      return { ok: true, stdout: result.stdout, stderr: result.stderr };
    } catch (error) {
      const stderr = error instanceof Error ? error.message : 'command failed';
      return { ok: false, stdout: '', stderr };
    }
  }
}
