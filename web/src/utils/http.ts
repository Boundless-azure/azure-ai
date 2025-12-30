/**
 * @title HTTP Client
 * @description A fetch-based HTTP client with interceptors and typing.
 * @keywords-cn HTTP客户端, 请求封装, 拦截器
 * @keywords-en http-client, request-wrapper, interceptors
 */

import type { BaseResponse } from './types';

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
      let response = await fetch(fullUrl, finalConfig);

      // Apply response interceptors
      for (const interceptor of this.responseInterceptors) {
        response = await interceptor(response);
      }

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const data = await response.json();
      return data as BaseResponse<T>;
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
      ? '?' + new URLSearchParams(params).toString()
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

// Example Interceptor: Add token
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
