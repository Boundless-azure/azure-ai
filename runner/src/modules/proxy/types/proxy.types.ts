/**
 * @title 代理类型定义
 * @description 定义代理模块中使用的数据结构。
 * @keywords-cn 代理类型, 转发, 类型定义
 * @keywords-en proxy-types, forward, type-definitions
 */
export interface ProxyTarget {
  host: string;
  port: number;
  appId?: string;
}

export interface ForwardRequest {
  domain?: string;
  path?: string;
}
