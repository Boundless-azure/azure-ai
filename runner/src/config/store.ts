import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * @title Runner 本地配置存储
 * @description 管理 runner 本地配置文件读写，用于启动与注册流程。
 * @keywords-cn 本地配置, 文件存储, 注册配置
 * @keywords-en local-config, file-store, registration-config
 */
export interface RunnerLocalConfig {
  serverPort: number;
  saasSocketUrl: string;
  runnerId: string;
  runnerKey: string;
  hookbusDebugEnabled: boolean;
  mongoUri: string;
  mongoDbName: string;
  runnerDbName: string;
  redisUri: string;
  /** frpc 二进制文件路径，Unix 默认 /usr/local/bin/frpc，Windows 默认 frpc（需在 PATH 中） */
  frpcBinPath: string;
  /**
   * frpc 本地监听端口（即 frpc.toml 的 localPort）
   * - Docker 模式： 80（Caddy 内网）
   * - 宿主机模式： 4310（直接指向 runner app）
   */
  frpcLocalPort: number;
}

const defaultConfig: RunnerLocalConfig = {
  serverPort: 4310,
  saasSocketUrl: '',
  runnerId: '',
  runnerKey: '',
  hookbusDebugEnabled: false,
  mongoUri: '',
  mongoDbName: '',
  runnerDbName: 'runner',
  redisUri: '',
  /** Unix 用 /usr/local/bin/frpc，Windows 用 frpc（需在 PATH 中） */
  frpcBinPath: process.platform === 'win32' ? 'frpc' : '/usr/local/bin/frpc',
  /**
   * 宿主机运行时默认直接指向 runner；
   * Docker 模式下通过 UI 或配置文件改为 80 (Caddy)
   */
  frpcLocalPort: process.platform === 'win32' ? 4310 : 80,
};

const configPath = join(process.cwd(), 'runner.data', 'config.json');

export function getRunnerConfig(): RunnerLocalConfig {
  if (!existsSync(configPath)) {
    return { ...defaultConfig };
  }
  try {
    const content = readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(content) as Partial<RunnerLocalConfig>;
    return { ...defaultConfig, ...parsed };
  } catch {
    return { ...defaultConfig };
  }
}

export function saveRunnerConfig(
  patch: Partial<RunnerLocalConfig>,
): RunnerLocalConfig {
  const next = { ...getRunnerConfig(), ...patch };
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
