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

export function saveRunnerConfig(patch: Partial<RunnerLocalConfig>): RunnerLocalConfig {
  const next = { ...getRunnerConfig(), ...patch };
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
