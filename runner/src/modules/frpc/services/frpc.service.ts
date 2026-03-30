import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { writeFile, mkdir, readFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { FrpcConfig } from '../types/frpc.types';

/** frpc 管理 API 默认端口 */
const DEFAULT_ADMIN_PORT = 7400;

/**
 * @title FRPC 服务
 * @description 管理 FRP Client (v0.50+) 的 TOML 配置生成、进程生命周期与管理 API 调用。
 *              frpc 启动时携带 metadata.runner_key，供 frps server plugin 鉴权；
 *              通过 admin API (localhost:adminPort) 进行动态代理管理，无需重启进程。
 *
 * @keywords-cn FRPC服务, TOML配置, 进程管理, 管理API, metadata
 * @keywords-en frpc-service, toml-config, process-lifecycle, admin-api, metadata
 */
export class FrpcService {
  private frpcProcess: ChildProcess | null = null;
  private configDir = join(process.cwd(), 'runner.data', 'frp');
  private configFile = join(this.configDir, 'frpc.toml');
  private pidFile = join(process.cwd(), 'runner.data', 'frp', 'frpc.pid');
  private adminPort = DEFAULT_ADMIN_PORT;

  constructor(private readonly frpcBinPath = '/usr/local/bin/frpc') {}

  /**
   * @title 生成 FRPC TOML 配置文件
   * @description 生成包含 serverAddr/auth/metadata/webServer/proxy 各节的 TOML 配置。
   *              metadata.runner_key 用于 frps server plugin 鉴权。
   * @param config FRPC 配置（含 serverToken、runnerKey、admissionPort）
   * @returns 配置文件绝对路径
   * @keywords-cn 生成TOML配置, FRPC配置, metadata
   * @keywords-en generate-toml-config, frpc-config, metadata
   */
  async generateConfig(config: FrpcConfig): Promise<string> {
    await mkdir(this.configDir, { recursive: true });
    const logDir = join(this.configDir, 'logs');
    await mkdir(logDir, { recursive: true });

    this.adminPort = config.adminPort ?? DEFAULT_ADMIN_PORT;
    const localPort = config.localPort ?? 80;

    const toml = `# frpc 配置 (自动生成, 请勿手动修改)
serverAddr = "${config.serverAddr}"
serverPort = ${config.serverPort}

[auth]
method = "token"
token = "${config.serverToken}"

# metadata 传递 runner key，frps server plugin 用于鉴权
[metadatas]
runner_key = "${config.runnerKey}"

[log]
to = "${logDir.replace(/\\/g, '/')}/frpc.log"
level = "info"
maxDays = 3

[transport]
poolCount = 5

# frpc 管理 API（用于动态代理控制）
[webServer]
addr = "127.0.0.1"
port = ${this.adminPort}

# 默认穿透代理：本地 Caddy → frps 分配端口
[[proxies]]
name = "runner-tunnel"
type = "tcp"
localIP = "127.0.0.1"
localPort = ${localPort}
remotePort = ${config.admissionPort}
`;
    await writeFile(this.configFile, toml, 'utf-8');
    console.log(
      `[FrpcService][TRACE] Config written: serverAddr=${config.serverAddr} serverPort=${config.serverPort} admissionPort=${config.admissionPort} localPort=${localPort}`,
    );
    return this.configFile;
  }

  /**
   * @title 启动 FRPC 进程
   * @description 先清理孤儿进程（读 PID 文件），再 spawn 新进程并落盘 PID。
   *              跨 tsx 热重载也能确保旧进程被终止。
   * @keywords-cn 启动FRPC, frpc进程, PID文件, 孤儿进程
   * @keywords-en start-frpc, frpc-process, pid-file, orphan-process
   */
  async start(): Promise<void> {
    // 1. 先停当前实例持有的进程
    await this.stop();
    // 2. 清理上次（可能由热重载遗留的）孤儿进程
    await this.killOrphan();

    const proc = spawn(this.frpcBinPath, ['-c', this.configFile], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.frpcProcess = proc;

    // 3. 落盘 PID
    if (proc.pid) {
      await writeFile(this.pidFile, String(proc.pid), 'utf-8').catch(
        () => null,
      );
    }

    proc.stdout?.on('data', (data: Buffer) => {
      console.log('[frpc]', data.toString().trimEnd());
    });
    proc.stderr?.on('data', (data: Buffer) => {
      console.error('[frpc]', data.toString().trimEnd());
    });
    proc.on('error', (err: Error) => {
      console.error('[frpc] error:', err);
    });
    proc.on('exit', (code: number | null) => {
      console.log(`[frpc] exited with code ${code}`);
      this.frpcProcess = null;
      // 清除 PID 文件
      unlink(this.pidFile).catch(() => null);
    });

    console.log(`[frpc] started: ${this.configFile} (pid=${proc.pid})`);
  }

  /**
   * @title 停止 FRPC 进程
   * @description 发送 SIGTERM，等待进程退出（最长 3s），超时后 SIGKILL。
   * @keywords-cn 停止FRPC, frpc进程
   * @keywords-en stop-frpc, frpc-process
   */
  async stop(): Promise<void> {
    if (!this.frpcProcess) return;
    const proc = this.frpcProcess;
    this.frpcProcess = null;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch {
          /* ignore */
        }
        resolve();
      }, 3000);
      proc.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
      proc.kill('SIGTERM');
    });
    await unlink(this.pidFile).catch(() => null);
    console.log('[frpc] stopped');
  }

  /**
   * @title 清理孤儿 frpc 进程
   * @description 读取 PID 文件，kill 上次遗留的进程（处理 tsx 热重载场景）。
   * @keywords-cn 孤儿进程清理, PID文件, 热重载
   * @keywords-en orphan-cleanup, pid-file, hot-reload
   */
  private async killOrphan(): Promise<void> {
    if (!existsSync(this.pidFile)) return;
    try {
      const pidStr = await readFile(this.pidFile, 'utf-8');
      const pid = parseInt(pidStr.trim(), 10);
      if (!isNaN(pid)) {
        try {
          process.kill(pid, 'SIGTERM');
          console.log(`[frpc] killed orphan process pid=${pid}`);
          // 等 500ms 确保释放端口
          await new Promise((r) => setTimeout(r, 500));
        } catch {
          // 进程已不存在，忽略
        }
      }
    } catch {
      // 文件读取失败，忽略
    }
    await unlink(this.pidFile).catch(() => null);
  }

  /**
   * @title 通过管理 API 重载配置
   * @description 调用 frpc admin API GET /api/reload 使配置生效，无需重启进程。
   * @keywords-cn 重载配置, admin-api
   * @keywords-en reload-config, admin-api
   */
  async reloadViaApi(): Promise<void> {
    const url = `http://127.0.0.1:${this.adminPort}/api/reload`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`[frpc] admin reload failed: ${res.status}`);
    }
    console.log('[frpc] reloaded via admin API');
  }

  /**
   * @title 检查 FRPC 是否运行
   * @description 返回 frpc 进程是否存活。
   * @keywords-cn 运行状态, frpc进程
   * @keywords-en running-state, frpc-process
   */
  isRunning(): boolean {
    return this.frpcProcess !== null;
  }
}
