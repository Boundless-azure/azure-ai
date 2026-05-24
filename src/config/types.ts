export type DbType = 'mysql' | 'postgres' | 'sqlite';

/**
 * @title 配置类型定义
 * @description 定义应用程序各模块的配置接口
 * @keywords-cn 配置接口, 类型定义, 数据结构
 * @keywords-en config-interfaces, type-definitions, data-structures
 */
export interface DatabaseConfig {
  type: DbType;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  synchronize?: boolean;
  logging?: boolean;
}

export interface AIProxyConfig {
  enabled: boolean;
  url?: string;
  noProxy?: string;
}

export interface AIClientTuningConfig {
  timeoutMs?: number;
  maxRetries?: number;
}

export interface AIConfig {
  proxy: AIProxyConfig;
  client: AIClientTuningConfig;
}

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface LoggingConfig {
  level: LogLevel;
  prettyPrint: boolean;
  writeToFile: boolean;
  dir?: string;
}

export interface HookBusConfig {
  enabled: boolean;
  debug: boolean;
  bufferSize: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  tls?: boolean;
  url?: string;
}
