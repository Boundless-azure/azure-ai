export type DbType = 'mysql' | 'postgres' | 'sqlite';

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
