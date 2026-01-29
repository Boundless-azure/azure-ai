/**
 * @title HTTP Client
 * @description A fetch-based HTTP client with interceptors and typing.
 * @keywords-cn HTTP客户端, 请求封装, 拦截器
 * @keywords-en http-client, request-wrapper, interceptors
 */

import type { BaseResponse } from './types';
import { useUIStore } from '../modules/agent/store/ui.store';

type RequestInterceptor = (
  config: RequestInit,
) => RequestInit | Promise<RequestInit>;
type ResponseInterceptor = (response: Response) => Response | Promise<Response>;

export class HttpClient {
  private baseUrl: string;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  public addRequestInterceptor(interceptor: RequestInterceptor) {
    this.requestInterceptors.push(interceptor);
  }

  public addResponseInterceptor(interceptor: ResponseInterceptor) {
    this.responseInterceptors.push(interceptor);
  }

  private async request<T>(
    url: string,
    config: RequestInit = {},
  ): Promise<BaseResponse<T>> {
    let finalConfig = { ...config };

    // Apply request interceptors
    for (const interceptor of this.requestInterceptors) {
      finalConfig = await interceptor(finalConfig);
    }

    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;

    try {
      if (url.includes('/im/sessions')) {
        console.log('[HTTP] /im/sessions request:', {
          url: fullUrl,
          method: finalConfig.method || 'GET',
        });
      }
      let response = await fetch(fullUrl, finalConfig);

      // Apply response interceptors
      for (const interceptor of this.responseInterceptors) {
        response = await interceptor(response);
      }

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const json = (await response.json()) as unknown;
      const isWrapped =
        json !== null &&
        typeof json === 'object' &&
        'data' in json &&
        'code' in json;

      if (url.includes('/im/sessions')) {
        console.log('[HTTP] /im/sessions response:', {
          url: fullUrl,
          hasAuth: !!finalConfig.headers?.['Authorization'],
          isWrapped,
          json,
        });
      }

      if (isWrapped) {
        return json as BaseResponse<T>;
      }
      return {
        code: response.status,
        data: json as T,
        message: response.statusText || 'success',
        timestamp: Date.now(),
      } as BaseResponse<T>;
    } catch (error) {
      console.error('Request failed:', error);
      throw error;
    }
  }

  public get<T>(
    url: string,
    params?: Record<string, any>,
    config?: RequestInit,
  ) {
    const queryString = params
      ? (() => {
          const entries = Object.entries(params).filter(
            ([, v]) => v !== undefined && v !== null,
          );
          const search = new URLSearchParams();
          for (const [k, v] of entries) {
            search.append(k, String(v));
          }
          const qs = search.toString();
          return qs ? `?${qs}` : '';
        })()
      : '';
    return this.request<T>(`${url}${queryString}`, {
      ...config,
      method: 'GET',
    });
  }

  public post<T>(url: string, data?: any, config?: RequestInit) {
    return this.request<T>(url, {
      ...config,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config?.headers,
      },
      body: JSON.stringify(data),
    });
  }

  public put<T>(url: string, data?: any, config?: RequestInit) {
    return this.request<T>(url, {
      ...config,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...config?.headers,
      },
      body: JSON.stringify(data),
    });
  }

  public patch<T>(url: string, data?: any, config?: RequestInit) {
    return this.request<T>(url, {
      ...config,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...config?.headers,
      },
      body: JSON.stringify(data),
    });
  }

  public delete<T>(url: string, config?: RequestInit) {
    return this.request<T>(url, { ...config, method: 'DELETE' });
  }
}

const resolvedBase = (() => {
  const envBase = import.meta.env?.PUBLIC_API_BASE_URL as string | undefined;
  if (envBase && envBase.startsWith('/')) return envBase;
  if (envBase && envBase.startsWith('http')) {
    const isLocal = /localhost|127\.0\.0\.1/.test(envBase);
    return isLocal ? '/api' : envBase;
  }
  return '/api';
})();

export const http = new HttpClient(resolvedBase);

/**
 * @title HTTP Status Handler
 * @description Handles HTTP status codes centrally.
 */
export class HttpStatusHandler {
  private handlers: Map<number, (response: Response) => void> = new Map();

  constructor() {
    this.setupDefaultHandlers();
  }

  private setupDefaultHandlers() {
    this.register(401, () => {
      localStorage.removeItem('token');
      localStorage.removeItem('principal');
      localStorage.removeItem('abilityRules');
      window.location.href = '/login';
    });
    this.register(403, () => {
      const ui = useUIStore();
      ui.showToast('权限不足', 'warning', 4000);
    });
  }

  public register(status: number, handler: (response: Response) => void) {
    this.handlers.set(status, handler);
  }

  public handle(response: Response) {
    const handler = this.handlers.get(response.status);
    if (handler) {
      handler(response);
    }
  }
}

export const httpStatusHandler = new HttpStatusHandler();

// Request Interceptor: Add token
http.addRequestInterceptor((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  return config;
});

// Response Interceptor: Handle Status Codes
http.addResponseInterceptor((response) => {
  httpStatusHandler.handle(response);
  return response;
});
