/**
 * @title Resource URL Service
 * @description Frontend image and resource URL resolution with configurable public base URL.
 * @keywords-cn 图片路径, 资源地址, 基础地址
 * @keywords-en image-url, resource-url, base-url
 */

const EXTERNAL_URL_RE = /^(?:https?:|blob:|data:|\/\/)/i;
const LOCAL_API_HOST_RE = /localhost|127\.0\.0\.1|\[::1\]/i;

/**
 * @description Options for overriding the resource/image base URL.
 * @keyword-cn 基础地址, 图片路径, 资源地址
 * @keyword-en base-url, image-url, resource-url
 */
export interface ResolveResourceUrlOptions {
  baseUrl?: string | null;
}

/**
 * Resolve image paths for frontend rendering.
 * @param path Image path returned by backend or entered by user.
 * @param options Optional base URL override for previews and tests.
 * @returns Absolute, protocol URL, or public-base-prefixed path.
 * @keyword-cn 图片路径, 资源地址, 基础地址
 * @keyword-en image-url, resource-url, base-url
 */
export function resolveImageUrl(
  path?: string | null,
  options: ResolveResourceUrlOptions = {},
): string | undefined {
  const rawPath = typeof path === 'string' ? path.trim() : '';
  if (!rawPath) return undefined;
  if (EXTERNAL_URL_RE.test(rawPath)) return rawPath;

  const envResourceBase = import.meta.env?.PUBLIC_RESOURCE_BASE_URL as
    | string
    | undefined;
  const envApiBase = import.meta.env?.PUBLIC_API_BASE_URL as string | undefined;
  const configuredBase = (
    options.baseUrl ??
    envResourceBase ??
    envApiBase ??
    '/api'
  ).trim();

  let base = '/api';
  if (configuredBase.startsWith('/')) {
    base = configuredBase;
  } else if (/^https?:\/\//i.test(configuredBase)) {
    base = LOCAL_API_HOST_RE.test(configuredBase) ? '/api' : configuredBase;
  }

  const cleanPath = rawPath.replace(/^\/+/, '');
  let cleanBasePath = '';
  let absoluteBaseOrigin = '';
  if (base.startsWith('/')) {
    cleanBasePath = base.replace(/^\/+|\/+$/g, '');
  } else {
    try {
      const parsedBase = new URL(base);
      cleanBasePath = parsedBase.pathname.replace(/^\/+|\/+$/g, '');
      absoluteBaseOrigin = parsedBase.origin;
    } catch {
      cleanBasePath = '';
    }
  }
  if (
    cleanBasePath &&
    (cleanPath === cleanBasePath || cleanPath.startsWith(`${cleanBasePath}/`))
  ) {
    return absoluteBaseOrigin
      ? `${absoluteBaseOrigin}/${cleanPath}`
      : `/${cleanPath}`;
  }

  return `${base.replace(/\/+$/, '')}/${cleanPath}`;
}

/**
 * Resolve resource paths with the same rules as image rendering.
 * @param path Resource path returned by backend or stored in records.
 * @param options Optional base URL override for previews and tests.
 * @returns Absolute, protocol URL, or public-base-prefixed path.
 * @keyword-cn 资源地址, 图片路径, 基础地址
 * @keyword-en resource-url, image-url, base-url
 */
export function resolveResourceUrl(
  path?: string | null,
  options?: ResolveResourceUrlOptions,
): string | undefined {
  return resolveImageUrl(path, options);
}
