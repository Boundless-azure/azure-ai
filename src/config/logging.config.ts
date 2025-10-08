import type { LoggingConfig, LogLevel } from './types';

export function loadLoggingConfigFromEnv(): LoggingConfig {
  const level = (process.env.LOG_LEVEL || 'info') as LogLevel;
  const prettyPrint = (process.env.LOG_PRETTY || 'true') === 'true';
  const writeToFile = (process.env.LOG_TO_FILE || 'false') === 'true';
  const dir = process.env.LOG_DIR || 'logs';
  return { level, prettyPrint, writeToFile, dir };
}
