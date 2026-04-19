import * as os from 'node:os';

/**
 * @title Runner 系统状态服务（单例）
 * @description 获取 Runner 所在系统的 CPU、内存等性能数据。
 * @keywords-cn 系统状态, CPU, 内存, 性能监控
 * @keywords-en system-stats, cpu, memory, performance
 */

/**
 * @title CPU 使用率采样数据
 */
interface CpuSample {
  idle: number;
  total: number;
}

/**
 * @title 系统状态结果
 */
export interface SystemStats {
  cpuUsage: number;
  memoryUsage: number;
  totalMemory: number;
  freeMemory: number;
  cpuCount: number;
}

/**
 * @title RunnerStatsService
 * @description 提供系统性能数据采集能力（单例模式，保持 CPU 采样状态）。
 */
export class RunnerStatsService {
  private static _instance: RunnerStatsService | null = null;
  private lastCpuSample: CpuSample | null = null;

  /**
   * @title 获取单例实例
   */
  static getInstance(): RunnerStatsService {
    if (!RunnerStatsService._instance) {
      RunnerStatsService._instance = new RunnerStatsService();
    }
    return RunnerStatsService._instance;
  }

  /**
   * @title 获取系统状态
   * @description 返回 CPU 使用率、内存使用率等数据。
   * @returns 系统状态对象
   */
  getStats(): SystemStats {
    const cpuUsage = this.getCpuUsage();
    const memInfo = this.getMemoryUsage();
    return {
      cpuUsage,
      memoryUsage: memInfo.usagePercent,
      totalMemory: memInfo.total,
      freeMemory: memInfo.free,
      cpuCount: os.cpus().length,
    };
  }

  /**
   * @title 获取 CPU 使用率
   * @description 通过采样两次 CPU 空闲时间差计算使用率。
   * @returns CPU 使用率百分比 (0-100)
   */
  private getCpuUsage(): number {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        total += cpu.times[type as keyof typeof cpu.times];
      }
      idle += cpu.times.idle;
    }

    const currentSample: CpuSample = { idle, total };

    if (!this.lastCpuSample) {
      this.lastCpuSample = currentSample;
      return 0;
    }

    const idleDiff = currentSample.idle - this.lastCpuSample.idle;
    const totalDiff = currentSample.total - this.lastCpuSample.total;

    this.lastCpuSample = currentSample;

    if (totalDiff === 0) return 0;

    const usage = 100 - (100 * idleDiff) / totalDiff;
    return Math.round(usage * 100) / 100;
  }

  /**
   * @title 获取内存使用情况
   * @description 返回内存使用率百分比、总量和空闲量。
   * @returns 内存信息
   */
  private getMemoryUsage(): {
    usagePercent: number;
    total: number;
    free: number;
  } {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usagePercent = Math.round((used / total) * 10000) / 100;
    return { usagePercent, total, free };
  }
}
