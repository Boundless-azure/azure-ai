import type { AIConfig } from './types';

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
