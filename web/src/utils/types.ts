/**
 * @title Base Types
 * @description Common interfaces and types for the application.
 * @keywords-cn 基础类型, 接口定义
 * @keywords-en base-types, interface-definitions
 */

export interface BaseResponse<T = any> {
  code: number;
  data: T;
  message: string;
  timestamp?: number;
}

export interface Pagination<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PageParams {
  page?: number;
  pageSize?: number;
  [key: string]: any;
}
