import type { LoggingConfig, LogLevel } from './types';

/**
 * @title 日志配置加载
 * @description 从环境变量读取日志级别和输出配置
 * @keywords-cn 日志配置, 级别, 输出, 文件
 * @keywords-en logging-config, level, output, file
 */
export function loadLoggingConfigFromEnv(): LoggingConfig {
  const level = (process.env.LOG_LEVEL || 'info') as LogLevel;
  const prettyPrint = (process.env.LOG_PRETTY || 'true') === 'true';
  const writeToFile = (process.env.LOG_TO_FILE || 'false') === 'true';
  const dir = process.env.LOG_DIR || 'logs';
  return { level, prettyPrint, writeToFile, dir };
}
