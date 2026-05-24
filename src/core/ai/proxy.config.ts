/**
 * AI Proxy configuration helper
 * Reads environment variables to enable/disable HTTP(S) proxy for outbound AI requests.
 *
 * Usage:
 * - AI_PROXY_ENABLED: 'true' | '1' to enable; otherwise disabled
 * - AI_PROXY_URL: e.g. 'http://127.0.0.1:10808'
 * - AI_PROXY_NO_PROXY: optional comma-separated hosts to bypass proxy
 */
import {
  ProxyAgent,
  setGlobalDispatcher,
  fetch as undiciFetch,
  type Dispatcher,
} from 'undici';

export function applyAIProxyFromEnv(logger?: { log: (msg: string) => void }) {
  const enabledEnv = process.env.AI_PROXY_ENABLED?.toLowerCase();
  const enabled = enabledEnv === 'true' || enabledEnv === '1';
  const proxyUrl = process.env.AI_PROXY_URL?.trim();
  const noProxy = process.env.AI_PROXY_NO_PROXY?.trim();

  if (enabled && proxyUrl) {
    process.env.HTTP_PROXY = proxyUrl;
    process.env.HTTPS_PROXY = proxyUrl;
    if (noProxy) {
      process.env.NO_PROXY = noProxy;
    }
    logger?.log?.(
      `[AI Proxy] enabled: ${proxyUrl}${noProxy ? `, NO_PROXY=${noProxy}` : ''}`,
    );
  } else {
    // Ensure proxies are not applied if disabled or missing URL
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    // Preserve NO_PROXY unless explicitly provided
    logger?.log?.('[AI Proxy] disabled');
  }
}

/**
 * Apply global fetch override via undici's ProxyAgent to ensure all outbound
 * fetch requests (including those used by LangChain) honor proxy settings.
 */
export function applyAIProxyFetchOverride(logger?: {
  log: (msg: string) => void;
}) {
  const enabledEnv = process.env.AI_PROXY_ENABLED?.toLowerCase();
  const enabled = enabledEnv === 'true' || enabledEnv === '1';
  const proxyUrl = process.env.AI_PROXY_URL?.trim();
  if (!enabled || !proxyUrl) {
    logger?.log?.(
      '[AI Proxy] fetch override skipped (disabled or missing URL)',
    );
    return;
  }

  try {
    const agent = new ProxyAgent(proxyUrl);
    // Apply undici global dispatcher (for libraries using undici directly)
    setGlobalDispatcher(agent);
    // Override global fetch to ensure dispatcher is used with undici
    type UndiciFetch = typeof undiciFetch;
    type UndiciFetchParams0 = Parameters<UndiciFetch>[0];
    type UndiciFetchParams1 = Parameters<UndiciFetch>[1];
    type FetchInitWithDispatcher = UndiciFetchParams1 & {
      dispatcher?: Dispatcher;
    };

    const overriddenFetch: UndiciFetch = (
      input: UndiciFetchParams0,
      init?: UndiciFetchParams1,
    ) => {
      const opts: FetchInitWithDispatcher = { ...(init ?? {}) };
      opts.dispatcher = agent;
      return undiciFetch(input, opts);
    };
    (globalThis as unknown as { fetch: UndiciFetch }).fetch = overriddenFetch;
    logger?.log?.(`[AI Proxy] fetch override applied: ${proxyUrl}`);
  } catch (e) {
    logger?.log?.(`[AI Proxy] failed to apply fetch override: ${String(e)}`);
  }
}
