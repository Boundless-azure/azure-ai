import type { AIConfig } from './types';

/**
 * @title AI 配置加载
 * @description 从环境变量读取 AI 代理和客户端配置
 * @keywords-cn AI配置, 代理, 超时, 重试
 * @keywords-en ai-config, proxy, timeout, retry
 */
export function loadAIConfigFromEnv(): AIConfig {
  const enabled = (process.env.AI_PROXY_ENABLED || 'false') === 'true';
  const url = process.env.AI_PROXY_URL;
  const noProxy = process.env.AI_PROXY_NO_PROXY;
  const timeoutMs =
    parseInt(process.env.AI_TIMEOUT_MS || '180000', 10) || 180000; // 3 min default
  const maxRetries = parseInt(process.env.AI_MAX_RETRIES || '3', 10) || 3;

  return {
    proxy: { enabled, url, noProxy },
    client: { timeoutMs, maxRetries },
  };
}
