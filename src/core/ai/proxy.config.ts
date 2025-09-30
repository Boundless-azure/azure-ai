/**
 * AI Proxy configuration helper
 * Reads environment variables to enable/disable HTTP(S) proxy for outbound AI requests.
 *
 * Usage:
 * - AI_PROXY_ENABLED: 'true' | '1' to enable; otherwise disabled
 * - AI_PROXY_URL: e.g. 'http://127.0.0.1:10808'
 * - AI_PROXY_NO_PROXY: optional comma-separated hosts to bypass proxy
 */
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
