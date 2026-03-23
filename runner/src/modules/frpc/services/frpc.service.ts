import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { FrpcConfig, FrpcProxy } from '../types/frpc.types';

const execAsync = promisify(exec);

/**
 * @title FRPC 服务
 * @description 管理 FRP Client 的配置生成和进程启动。
 * @keywords-cn FRPC服务, 配置管理, 进程启动
 * @keywords-en frpc-service, config-management, process-start
 */
export class FrpcService {
  private frpcProcess: ReturnType<typeof exec> | null = null;
  private configDir = join(process.cwd(), 'runner.data', 'frp');
  private configFile = join(this.configDir, 'frpc.ini');

  constructor(
    private readonly frpcBinPath = '/usr/local/bin/frpc',
  ) {}

  /**
   * @title 生成 FRPC 配置文件
   * @description 根据配置生成 FRPC 配置文件。
   * @param config FRPC 配置
   * @keywords-cn 生成配置, FRPC配置
   * @keywords-en generate-config, frpc-config
   */
  async generateConfig(config: FrpcConfig): Promise<string> {
    await mkdir(this.configDir, { recursive: true });

    let proxySection = '';
    for (const proxy of config.proxies) {
      proxySection += `
[[proxy]]
name = "${proxy.name}"
type = "${proxy.type}"
local_ip = "${proxy.localIp}"
local_port = ${proxy.localPort}
custom_domains = ${proxy.customDomains.join(', ')}
`;
    }

    const iniContent = `[common]
server_addr = ${config.serverAddr}
server_port = ${config.serverPort}
auth_method = ${config.authMethod}
token = ${config.token}
pool_count = 10
tcp_mux = true
protocol = http
log_file = ./logs/frpc.log
log_level = info
log_max_days = 3
${proxySection}`;

    await writeFile(this.configFile, iniContent, 'utf-8');
    return this.configFile;
  }

  /**
   * @title 启动 FRPC
   * @description 启动 FRP Client 进程。
   * @param configFile 配置文件路径
   * @keywords-cn 启动FRPC, frpc进程
   * @keywords-en start-frpc, frpc-process
   */
  async start(configFile?: string): Promise<void> {
    const cfg = configFile || this.configFile;

    // 先停止已有的
    await this.stop();

    // 启动新的
    const logDir = join(this.configDir, 'logs');
    await mkdir(logDir, { recursive: true });

    this.frpcProcess = exec(`${this.frpcBinPath} -c "${cfg}"`, {
      cwd: this.configDir,
    });

    this.frpcProcess.stdout?.on('data', (data) => {
      console.log('[frpc]', data.toString().trim());
    });

    this.frpcProcess.stderr?.on('data', (data) => {
      console.error('[frpc]', data.toString().trim());
    });

    this.frpcProcess.on('error', (err) => {
      console.error('[frpc] error:', err);
    });

    console.log(`[frpc] started with config: ${cfg}`);
  }

  /**
   * @title 停止 FRPC
   * @description 停止 FRP Client 进程。
   * @keywords-cn 停止FRPC, frpc进程
   * @keywords-en stop-frpc, frpc-process
   */
  async stop(): Promise<void> {
    if (this.frpcProcess) {
      this.frpcProcess.kill('SIGTERM');
      this.frpcProcess = null;
      console.log('[frpc] stopped');
    }
  }

  /**
   * @title 重载 FRPC 配置
   * @description 发送信号让 FRPC 重载配置。
   * @keywords-cn 重载配置, FRPC配置
   * @keywords-en reload-frpc, frpc-config
   */
  async reload(): Promise<void> {
    if (this.frpcProcess) {
      this.frpcProcess.kill('SIGHUP');
      console.log('[frpc] reloaded');
    }
  }

  /**
   * @title 添加代理
   * @description 动态添加一个 FRP 代理配置。
   * @param proxy 代理配置
   * @keywords-cn 添加代理, FRP代理
   * @keywords-en add-proxy, frp-proxy
   */
  async addProxy(proxy: FrpcProxy): Promise<void> {
    // 追加到配置文件
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(this.configFile, 'utf-8');
    const newProxy = `
[[proxy]]
name = "${proxy.name}"
type = "${proxy.type}"
local_ip = "${proxy.localIp}"
local_port = ${proxy.localPort}
custom_domains = ${proxy.customDomains.join(', ')}
`;
    await fs.writeFile(this.configFile, content + newProxy, 'utf-8');
    await this.reload();
  }

  /**
   * @title 移除代理
   * @description 从配置中移除一个 FRP 代理。
   * @param proxyName 代理名称
   * @keywords-cn 移除代理, FRP代理
   * @keywords-en remove-proxy, frp-proxy
   */
  async removeProxy(proxyName: string): Promise<void> {
    const fs = await import('node:fs/promises');
    let content = await fs.readFile(this.configFile, 'utf-8');
    // 简单移除该 proxy block
    const regex = new RegExp(`\\n\\[\\[proxy\\]\\]\\nname = "${proxyName}".*?(?=\\n\\[\\[proxy\\]\\]|\\n\\[common\\]|$)`, 's');
    content = content.replace(regex, '');
    await fs.writeFile(this.configFile, content, 'utf-8');
    await this.reload();
  }

  /**
   * @title 检查 FRPC 是否运行
   * @description 返回 FRPC 进程是否在运行。
   * @keywords-cn 检查状态, FRPC运行
   * @keywords-en check-status, frpc-running
   */
  isRunning(): boolean {
    return this.frpcProcess !== null;
  }
}
